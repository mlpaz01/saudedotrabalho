export type CatValidationSeverity = "error" | "warning" | "info";

export type CatValidationIssue = {
  code: string;
  severity: CatValidationSeverity;
  field: string;
  message: string;
  suggestion?: string;
};

export type CatValidationResult = {
  status: "ready" | "review" | "blocked";
  canSave: boolean;
  errors: number;
  warnings: number;
  issues: CatValidationIssue[];
  summary: {
    causativeAgent: { code: string; description: string };
    generatingSituation: { code: string; description: string };
    bodyPart: { code: string; description: string; laterality: string };
    injuryNature: { code: string; description: string };
    diagnosis: string;
    cid: string;
  };
};

type CatValidationContext = {
  input: Record<string, any>;
  worker: Record<string, any>;
  company: Record<string, any>;
  invalidOfficialCodes?: Array<{ field: string; code: string; table: string }>;
  now?: Date;
};

function normalized(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function hasAny(value: unknown, terms: string[]) {
  const text = normalized(value);
  return terms.some(term => text.includes(normalized(term)));
}

function validCpf(value: unknown) {
  const cpf = digits(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const calculate = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index++)
      sum += Number(cpf[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculate(9) === Number(cpf[9]) && calculate(10) === Number(cpf[10]);
}

function validHours(value: unknown) {
  const raw = String(value || "").replace(":", "");
  if (!/^\d{4}$/.test(raw)) return false;
  return Number(raw.slice(0, 2)) <= 99 && Number(raw.slice(2)) <= 59;
}

function dateValue(value: unknown) {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function mysqlDateTime(value: unknown) {
  const raw = String(value || "").trim();
  const local = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (local) return `${local[1]} ${local[2]}:${local[3]}:${local[4] || "00"}`;
  const parsed = dateValue(value);
  if (!parsed) return null;
  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

export function normalizeCatLocationType(value: unknown) {
  const raw = String(value || "");
  const legacy: Record<string, string> = {
    estabelecimento_empregador: "1",
    estabelecimento_exterior: "2",
    estabelecimento_terceiros: "3",
    via_publica: "4",
    area_rural: "5",
    embarcacao: "6",
    outros: "9",
  };
  return legacy[raw] || raw;
}

export function validateCatDraft({
  input,
  worker,
  company,
  invalidOfficialCodes = [],
  now = new Date(),
}: CatValidationContext): CatValidationResult {
  const issues: CatValidationIssue[] = [];
  const error = (
    code: string,
    field: string,
    message: string,
    suggestion?: string
  ) => issues.push({ code, field, message, suggestion, severity: "error" });
  const warning = (
    code: string,
    field: string,
    message: string,
    suggestion?: string
  ) => issues.push({ code, field, message, suggestion, severity: "warning" });

  const eventAt = dateValue(input.eventAt);
  const attendanceAt = dateValue(input.medicalAttendanceAt);
  const accidentType = String(input.accidentType || "");
  const catType = String(input.catType || "inicial");
  const locationType = normalizeCatLocationType(input.locationType);
  const narrative = [
    input.description,
    input.diagnosis,
    input.medicalNotes,
  ].join(" ");

  if (!worker?.id)
    error(
      "CAT_WORKER_NOT_FOUND",
      "collaboratorId",
      "Colaborador não localizado na empresa."
    );
  if (!validCpf(worker?.cpf))
    error(
      "CAT_WORKER_CPF",
      "collaboratorId",
      "O colaborador precisa possuir CPF válido antes da emissão da CAT.",
      "Atualize o CPF no cadastro do colaborador."
    );
  if (!String(worker?.employee_registration || "").trim())
    error(
      "CAT_WORKER_REGISTRATION",
      "collaboratorId",
      "A matrícula do colaborador não está cadastrada.",
      "Informe a matrícula do vínculo. Para TSVE sem matrícula, será necessário cadastrar a categoria eSocial."
    );

  const employerNumber = digits(
    input.employerRegistrationNumber || company?.cnpj
  );
  if (
    !["cnpj", "cpf"].includes(String(input.employerRegistrationType || "cnpj"))
  )
    error(
      "CAT_EMPLOYER_REGISTRATION_TYPE",
      "employerRegistrationType",
      "No S-2210, a identificação do empregador deve utilizar CNPJ ou CPF."
    );
  if (!employerNumber)
    error(
      "CAT_EMPLOYER_REGISTRATION",
      "employerRegistrationNumber",
      "A inscrição do empregador é obrigatória."
    );
  else if (
    String(input.employerRegistrationType || "cnpj") === "cnpj" &&
    employerNumber.length !== 14
  )
    error(
      "CAT_EMPLOYER_CNPJ",
      "employerRegistrationNumber",
      "O CNPJ do empregador deve possuir 14 dígitos."
    );

  if (!eventAt)
    error(
      "CAT_EVENT_DATE",
      "eventAt",
      "Informe uma data e hora válidas para o acidente."
    );
  else if (eventAt.getTime() > now.getTime())
    error(
      "CAT_EVENT_FUTURE",
      "eventAt",
      "A data do acidente não pode estar no futuro."
    );
  if (
    !accidentType ||
    !["tipico", "trajeto", "doenca_ocupacional"].includes(accidentType)
  )
    error("CAT_ACCIDENT_TYPE", "accidentType", "Selecione o tipo do acidente.");
  if (
    ["tipico", "trajeto"].includes(accidentType) &&
    !validHours(input.hoursWorkedBeforeAccident)
  )
    error(
      "CAT_WORKED_HOURS",
      "hoursWorkedBeforeAccident",
      "Informe as horas trabalhadas antes do acidente no formato HH:MM.",
      "Use 00:00 quando o trabalhador ainda não tiver iniciado a jornada."
    );
  if (!String(input.lastWorkedDate || "").trim())
    error(
      "CAT_LAST_WORKED_DATE",
      "lastWorkedDate",
      "Informe o último dia trabalhado, obrigatório para acidentes atuais no S-2210."
    );
  if (
    accidentType === "doenca_ocupacional" &&
    String(input.hoursWorkedBeforeAccident || "").trim()
  )
    warning(
      "CAT_DISEASE_WORKED_HOURS",
      "hoursWorkedBeforeAccident",
      "Horas trabalhadas antes do acidente não devem ser informadas para doença ocupacional."
    );
  if (catType !== "inicial" && !String(input.originReceipt || "").trim())
    error(
      "CAT_ORIGIN_RECEIPT",
      "originReceipt",
      "Reabertura e comunicação de óbito exigem o recibo da CAT de origem."
    );

  if (!/^(?:[1-6]|9)$/.test(locationType))
    error(
      "CAT_LOCATION_TYPE",
      "locationType",
      "Selecione um tipo de local válido do S-2210."
    );
  if (!String(input.location || "").trim())
    error(
      "CAT_LOCATION_ADDRESS",
      "location",
      "Informe o logradouro/local do acidente."
    );
  if (!String(input.locationNumber || "").trim())
    error(
      "CAT_LOCATION_NUMBER",
      "locationNumber",
      "Informe o número do local ou S/N."
    );
  if (["1", "3", "4", "5"].includes(locationType)) {
    if (!/^\d{7}$/.test(digits(input.eventCityCode)))
      error(
        "CAT_CITY_CODE",
        "eventCityCode",
        "Informe o código IBGE do município com 7 dígitos."
      );
    if (!/^[A-Z]{2}$/.test(String(input.eventUf || "").toUpperCase()))
      error(
        "CAT_UF",
        "eventUf",
        "Informe uma UF válida para o local do acidente."
      );
  }
  if (
    ["1", "3", "5"].includes(locationType) &&
    !/^\d{8}$/.test(digits(input.postalCode))
  )
    error("CAT_POSTAL_CODE", "postalCode", "Informe o CEP com 8 dígitos.");
  if (locationType === "3" && !digits(input.locationRegistration))
    error(
      "CAT_THIRD_PARTY_REGISTRATION",
      "locationRegistration",
      "Acidente em estabelecimento de terceiros exige a inscrição do local."
    );
  if (locationType === "2") {
    if (!/^\d{3}$/.test(digits(input.eventCountryCode)))
      error(
        "CAT_COUNTRY_CODE",
        "eventCountryCode",
        "Informe o código do país com 3 dígitos."
      );
    if (!String(input.foreignPostalCode || "").trim())
      error(
        "CAT_FOREIGN_POSTAL",
        "foreignPostalCode",
        "Informe o código postal do local no exterior."
      );
  }

  if (String(input.description || "").trim().length < 10)
    error(
      "CAT_DESCRIPTION",
      "description",
      "Descreva o acidente com pelo menos 10 caracteres."
    );
  for (const [field, label] of [
    ["causativeAgentCode", "agente causador"],
    ["generatingSituationCode", "situação geradora"],
    ["bodyPartCode", "parte do corpo"],
    ["injuryNatureCode", "natureza da lesão"],
  ] as const) {
    if (!String(input[field] || "").trim())
      error(
        `CAT_${field.toUpperCase()}`,
        field,
        `Selecione o código de ${label} na tabela oficial.`
      );
  }
  invalidOfficialCodes.forEach(item =>
    error(
      "CAT_OFFICIAL_CODE",
      item.field,
      `O código ${item.code} não pertence à Tabela ${item.table} do eSocial S-1.3.`
    )
  );

  if (!attendanceAt)
    error(
      "CAT_MEDICAL_DATE",
      "medicalAttendanceAt",
      "Informe a data e hora do atendimento médico."
    );
  else if (eventAt && attendanceAt.getTime() < eventAt.getTime())
    error(
      "CAT_MEDICAL_BEFORE_EVENT",
      "medicalAttendanceAt",
      "O atendimento médico não pode ser anterior ao acidente."
    );
  else if (attendanceAt.getTime() > now.getTime())
    error(
      "CAT_MEDICAL_FUTURE",
      "medicalAttendanceAt",
      "O atendimento médico não pode estar no futuro."
    );
  if (
    !Number.isInteger(Number(input.treatmentDays)) ||
    Number(input.treatmentDays) < 1
  )
    error(
      "CAT_TREATMENT_DAYS",
      "treatmentDays",
      "Informe a duração estimada do tratamento em dias."
    );
  const cid = String(input.cid || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(cid))
    error(
      "CAT_CID",
      "cid",
      "Informe o CID com 3 ou 4 caracteres alfanuméricos, sem ponto."
    );
  if (!String(input.doctorName || "").trim())
    error(
      "CAT_DOCTOR_NAME",
      "doctorName",
      "Informe o nome do médico ou dentista emitente."
    );
  if (!/^(CRM|CRO|RMS)$/i.test(String(input.doctorCouncil || "")))
    error(
      "CAT_DOCTOR_COUNCIL",
      "doctorCouncil",
      "Selecione CRM, CRO ou RMS como órgão de classe."
    );
  if (!String(input.doctorRegistration || "").trim())
    error(
      "CAT_DOCTOR_REGISTRATION",
      "doctorRegistration",
      "Informe o registro do profissional."
    );
  if (
    /^(CRM|CRO)$/i.test(String(input.doctorCouncil || "")) &&
    !/^[A-Z]{2}$/.test(String(input.doctorUf || "").toUpperCase())
  )
    error(
      "CAT_DOCTOR_UF",
      "doctorUf",
      "Informe a UF do conselho profissional."
    );

  if (input.deathOccurred || catType === "comunicacao_obito") {
    const deathDate = dateValue(input.deathDate);
    if (!deathDate)
      error("CAT_DEATH_DATE", "deathDate", "Informe a data do óbito.");
    else if (eventAt && deathDate.getTime() < eventAt.getTime())
      error(
        "CAT_DEATH_BEFORE_EVENT",
        "deathDate",
        "A data do óbito não pode ser anterior ao acidente."
      );
  }

  const injuryText = normalized(input.injuryNature);
  const selectedTwistNature =
    hasAny(injuryText, ["distensão, torção", "distensao, torcao"]) &&
    !hasAny(injuryText, [
      "não inclui distensão",
      "nao inclui distensao",
      "não inclui torção",
      "nao inclui torcao",
    ]);
  if (
    hasAny(narrative, [
      "entorse",
      "torção",
      "torcao",
      "distensão",
      "distensao",
    ]) &&
    !selectedTwistNature
  )
    error(
      "CAT_INJURY_TWIST_MISMATCH",
      "injuryNatureCode",
      "O relato/diagnóstico indica entorse ou torção, mas a natureza da lesão selecionada não corresponde.",
      "Revise a opção 'Distensão, torção' na Tabela 17."
    );
  if (
    hasAny(narrative, [
      "escada portátil",
      "escada portatil",
      "escada móvel",
      "escada movel",
    ]) &&
    hasAny(input.causativeAgent, ["escada permanente"])
  )
    error(
      "CAT_LADDER_AGENT_MISMATCH",
      "causativeAgentCode",
      "O relato menciona escada portátil/móvel, mas o agente causador selecionado é uma escada permanente.",
      "Pesquise uma opção de escada móvel na Tabela 14."
    );
  const agentIsPermanentLadder = hasAny(input.causativeAgent, [
    "escada permanente",
  ]);
  const agentIsMobileLadder = hasAny(input.causativeAgent, [
    "escada móvel",
    "escada movel",
  ]);
  const situationIsPermanentLadder = hasAny(input.generatingSituation, [
    "escada permanente",
  ]);
  const situationIsMobileLadder = hasAny(input.generatingSituation, [
    "escada móvel",
    "escada movel",
  ]);
  if (
    (agentIsPermanentLadder && situationIsMobileLadder) ||
    (agentIsMobileLadder && situationIsPermanentLadder)
  )
    error(
      "CAT_LADDER_CODES_MISMATCH",
      "generatingSituationCode",
      "O agente causador e a situação geradora descrevem tipos diferentes de escada.",
      "Escolha códigos que representem o mesmo equipamento e a mesma dinâmica do acidente."
    );
  if (
    hasAny(narrative, ["direito", "direita"]) &&
    String(input.laterality) === "esquerda"
  )
    error(
      "CAT_LATERALITY_RIGHT",
      "laterality",
      "O relato indica lado direito, mas a lateralidade selecionada é esquerda."
    );
  if (
    hasAny(narrative, ["esquerdo", "esquerda"]) &&
    String(input.laterality) === "direita"
  )
    error(
      "CAT_LATERALITY_LEFT",
      "laterality",
      "O relato indica lado esquerdo, mas a lateralidade selecionada é direita."
    );
  if (
    hasAny(narrative, ["tornozelo"]) &&
    !hasAny(input.bodyPart, ["pé", "pe", "perna", "membro inferior"])
  )
    warning(
      "CAT_ANKLE_BODY_PART",
      "bodyPartCode",
      "O relato menciona tornozelo; confirme se a parte do corpo selecionada representa corretamente essa região."
    );

  const errors = issues.filter(issue => issue.severity === "error").length;
  const warnings = issues.filter(issue => issue.severity === "warning").length;
  return {
    status: errors ? "blocked" : warnings ? "review" : "ready",
    canSave: errors === 0,
    errors,
    warnings,
    issues,
    summary: {
      causativeAgent: {
        code: String(input.causativeAgentCode || ""),
        description: String(input.causativeAgent || ""),
      },
      generatingSituation: {
        code: String(input.generatingSituationCode || ""),
        description: String(input.generatingSituation || ""),
      },
      bodyPart: {
        code: String(input.bodyPartCode || ""),
        description: String(input.bodyPart || ""),
        laterality: String(input.laterality || "nao_aplicavel"),
      },
      injuryNature: {
        code: String(input.injuryNatureCode || ""),
        description: String(input.injuryNature || ""),
      },
      diagnosis: String(input.diagnosis || ""),
      cid,
    },
  };
}
