import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  tinyint,
  varchar,
  float,
  json,
  decimal} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 30 }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  companyId: int("company_id"),
  branchId: int("branch_id"),
  sectorId: int("sector_id"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Corporate Emails (whitelist) ────────────────────────────────────────────
export const corporateEmails = mysqlTable("corporate_emails", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  company: varchar("company", { length: 255 }),
  sector: varchar("sector", { length: 255 }),
  employeeName: varchar("employeeName", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  hasSetPassword: boolean("hasSetPassword").default(false).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  userId: int("userId"),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
  lastAccessAt: timestamp("lastAccessAt"),
  companyId: int("company_id"),
  branchId: int("branch_id"),
  sectorId: int("sector_id"),
});

export type CorporateEmail = typeof corporateEmails.$inferSelect;
export type InsertCorporateEmail = typeof corporateEmails.$inferInsert;

// ─── Modules ─────────────────────────────────────────────────────────────────
export const modules = mysqlTable("modules", {
  id: int("id").autoincrement().primaryKey(),
  orderIndex: int("orderIndex").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  videoUrl: varchar("videoUrl", { length: 1024 }),
  thumbnailUrl: varchar("thumbnailUrl", { length: 1024 }),
  durationMinutes: int("durationMinutes").default(0),
   isActive: boolean("isActive").default(true).notNull(),
  publishStatus: varchar("publish_status", { length: 20 }).default("published").notNull(),
  // Certificate configuration
  certTitle: varchar("certTitle", { length: 255 }),
  certBody: text("certBody"),
  certSignerName: varchar("certSignerName", { length: 255 }),
  certSignerRole: varchar("certSignerRole", { length: 255 }),
  validityDays: int("validity_days"),
  isMandatory: boolean("is_mandatory").default(false),
  profession: varchar("profession", { length: 100 }),
  isCatalogMaster: boolean("is_catalog_master").default(false).notNull(),
  createdByCompanyId: int("created_by_company_id"),
  clonedFromModuleId: int("cloned_from_module_id"),
  isTemplate: boolean("is_template").default(false).notNull(),
  templateCategory: varchar("template_category", { length: 50 }),
  imageUrl: varchar("image_url", { length: 1024 }),
  isGame: boolean("is_game").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Module = typeof modules.$inferSelect;
export type InsertModule = typeof modules.$inferInsert;

// ─── User Progress ────────────────────────────────────────────────────────────
export const userProgress = mysqlTable("user_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  moduleId: int("moduleId").notNull(),
  percentWatched: float("percentWatched").default(0).notNull(),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  lastWatchedAt: timestamp("lastWatchedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = typeof userProgress.$inferInsert;

// ─── Certificates ─────────────────────────────────────────────────────────────
export const certificates = mysqlTable("certificates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  moduleId: int("moduleId").notNull(),
  certificateCode: varchar("certificateCode", { length: 64 }).notNull().unique(),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  pdfUrl: varchar("pdfUrl", { length: 1024 }),
  expiresAt: timestamp("expires_at"),
});

export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = typeof certificates.$inferInsert;

// ─── Decompression Videos ─────────────────────────────────────────────────────
export const decompressionVideos = mysqlTable("decompression_videos", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["yoga", "meditacao", "respiracao", "outro"]).notNull(),
  videoUrl: varchar("videoUrl", { length: 1024 }),
  thumbnailUrl: varchar("thumbnailUrl", { length: 1024 }),
  durationMinutes: int("durationMinutes").default(0),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  orderIndex: int("orderIndex").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DecompressionVideo = typeof decompressionVideos.$inferSelect;
export type InsertDecompressionVideo = typeof decompressionVideos.$inferInsert;

// ─── Reminder Settings ────────────────────────────────────────────────────────
export const reminderSettings = mysqlTable("reminder_settings", {
  id: int("id").autoincrement().primaryKey(),
  inactiveDaysThreshold: int("inactiveDaysThreshold").default(7).notNull(),
  lowEngagementThreshold: float("lowEngagementThreshold").default(30).notNull(), // percentage
  isEnabled: boolean("isEnabled").default(true).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReminderSettings = typeof reminderSettings.$inferSelect;

// ─── Email Logs ───────────────────────────────────────────────────────────────
export const emailLogs = mysqlTable("email_logs", {
  id: int("id").autoincrement().primaryKey(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  type: mysqlEnum("type", ["reminder_employee", "alert_rh", "welcome"]).notNull(),
  subject: varchar("subject", { length: 512 }),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  success: boolean("success").default(true).notNull(),
  errorMessage: text("errorMessage"),
});

export type EmailLog = typeof emailLogs.$inferSelect;
// ─── Lessons (aulas dentro de módulos) ───────────────────────────────────────
export const lessons = mysqlTable("lessons", {
  id: int("id").autoincrement().primaryKey(),
  moduleId: int("moduleId").notNull(),
  orderIndex: int("orderIndex").default(0).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  videoUrl: varchar("videoUrl", { length: 1024 }),
  durationMinutes: int("durationMinutes").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  imageUrl: varchar("image_url", { length: 1024 }),
  isGame: boolean("is_game").default(false).notNull(),
  audioUrl: varchar("audio_url", { length: 1024 }),
  pdfUrl: varchar("pdf_url", { length: 1024 }),
  content: text("content"),
});
export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;

// ─── Lesson Progress ──────────────────────────────────────────────────────────
export const lessonProgress = mysqlTable("lesson_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  lessonId: int("lessonId").notNull(),
  moduleId: int("moduleId").notNull(),
  percentWatched: float("percentWatched").default(0).notNull(),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  lastWatchedAt: timestamp("lastWatchedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type InsertLessonProgress = typeof lessonProgress.$inferInsert;

// ─── Companies ───────────────────────────────────────────────────────────────
export const companies = mysqlTable('companies', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  cnpj: varchar('cnpj', { length: 18 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  primaryColor: varchar('primary_color', { length: 20 }).default('#1e3a5f'),
  description: text('description'),
  phone: varchar('phone', { length: 30 }),
  website: varchar('website', { length: 255 }),
  address: text('address'),
  loginBgUrl: varchar('login_bg_url', { length: 500 }),
  isActive: int('is_active').notNull().default(1),
  plan: varchar('plan', { length: 50 }).default('essencial'),
  subscriptionStatus: varchar('subscription_status', { length: 20 }).default('trial'),
  mrr: varchar('mrr', { length: 30 }).default('0'),
  subscriptionStartedAt: timestamp('subscription_started_at'),
  maxEmployees: int('max_employees').default(50),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const companyContentEnrollments = mysqlTable('company_content_enrollments', {
  id: int('id').autoincrement().primaryKey(),
  companyId: int('company_id').notNull(),
  contentType: varchar('content_type', { length: 20 }).notNull(),
  contentId: int('content_id').notNull(),
  isActive: tinyint('is_active').default(1),
  assignedToBranches: json('assigned_to_branches'),
  assignedToDepartments: json('assigned_to_departments'),
  enrolledAt: timestamp('enrolled_at').defaultNow(),
});

export const branches = mysqlTable('branches', {
  id: int('id').autoincrement().primaryKey(),
  companyId: int('company_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 2 }),
  isActive: int('is_active').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sectors = mysqlTable('sectors', {
  id: int('id').autoincrement().primaryKey(),
  companyId: int('company_id').notNull(),
  branchId: int('branch_id'),
  name: varchar('name', { length: 100 }).notNull(),
  isActive: int('is_active').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Quizzes ─────────────────────────────────────────────────────────────────
export const quizzes = mysqlTable('quizzes', {
  id: int('id').autoincrement().primaryKey(),
  lessonId: int('lesson_id').notNull(),
  passingScore: int('passing_score').notNull().default(70),
  isActive: tinyint('is_active').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
});

export const quizQuestions = mysqlTable('quiz_questions', {
  id: int('id').autoincrement().primaryKey(),
  quizId: int('quiz_id').notNull(),
  questionText: text('question_text').notNull(),
  orderIndex: int('order_index').notNull().default(0),
  points: int('points').notNull().default(1),
});

export const quizOptions = mysqlTable('quiz_options', {
  id: int('id').autoincrement().primaryKey(),
  questionId: int('question_id').notNull(),
  optionText: text('option_text').notNull(),
  isCorrect: tinyint('is_correct').notNull().default(0),
  orderIndex: int('order_index').notNull().default(0),
});

export const quizAttempts = mysqlTable('quiz_attempts', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  quizId: int('quiz_id').notNull(),
  lessonId: int('lesson_id').notNull(),
  score: int('score').notNull(),
  passed: tinyint('passed').notNull().default(0),
  answersJson: text('answers_json'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
});

export const auditLogs = mysqlTable('audit_logs', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id'),
  userEmail: varchar('user_email', { length: 255 }),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: int('entity_id'),
  detailsJson: text('details_json'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const lessonViewEvents = mysqlTable('lesson_view_events', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  lessonId: int('lesson_id').notNull(),
  moduleId: int('module_id').notNull(),
  videoPositionSeconds: int('video_position_seconds').notNull().default(0),
  videoDurationSeconds: int('video_duration_seconds').notNull().default(0),
  eventType: varchar('event_type', { length: 30 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const courseAcceptanceTerms = mysqlTable('course_acceptance_terms', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  moduleId: int('module_id').notNull(),
  termText: text('term_text').notNull(),
  userNameAtAcceptance: varchar('user_name_at_acceptance', { length: 255 }),
  userEmailAtAcceptance: varchar('user_email_at_acceptance', { length: 255 }),
  acceptedAt: timestamp('accepted_at').defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
});

// ─── Gamification ─────────────────────────────────────────────────────────────
export const userPoints = mysqlTable("user_points", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  points: int("points").notNull().default(0),
  reason: varchar("reason", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: int("entity_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userBadges = mysqlTable("user_badges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  badgeKey: varchar("badge_key", { length: 50 }).notNull(),
  badgeName: varchar("badge_name", { length: 100 }).notNull(),
  badgeIcon: varchar("badge_icon", { length: 10 }),
  awardedAt: timestamp("awarded_at").defaultNow(),
});

// ─── Learning Trails ─────────────────────────────────────────────────────────
export const learningTrails = mysqlTable("learning_trails", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  objective: text("objective"),
  thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
  isSequential: tinyint("is_sequential").notNull().default(0),
  isActive: tinyint("is_active").notNull().default(1),
  isCatalogMaster: boolean("is_catalog_master").default(false).notNull(),
  createdByCompanyId: int("created_by_company_id"),
  clonedFromTrailId: int("cloned_from_trail_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trailModules = mysqlTable("trail_modules", {
  id: int("id").autoincrement().primaryKey(),
  trailId: int("trail_id").notNull(),
  moduleId: int("module_id"),
  orderIndex: int("order_index").notNull().default(0),
  isRequired: tinyint("is_required").notNull().default(1),
  itemType: varchar("item_type", { length: 20 }).default("module"),
  quizConfig: json("quiz_config"),
  surveyId: int("survey_id"),
});

// ─── Professional Licenses ───────────────────────────────────────────────────
export const professionalLicenses = mysqlTable('professional_licenses', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  licenseType: varchar('license_type', { length: 100 }).notNull(),
  licenseNumber: varchar('license_number', { length: 100 }),
  issuedAt: timestamp('issued_at'),
  expiresAt: timestamp('expires_at'),
  documentUrl: varchar('document_url', { length: 500 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type ProfessionalLicense = typeof professionalLicenses.$inferSelect;
export type InsertProfessionalLicense = typeof professionalLicenses.$inferInsert;


// ─── Email Campaigns (Phase 2) ────────────────────────────────────────────────
export const emailCampaigns = mysqlTable("email_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("company_id").notNull(),
  createdByUserId: int("created_by_user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  campaignType: varchar("campaign_type", { length: 50 }).notNull(),
  targetModuleId: int("target_module_id"),
  targetSurveyId: int("target_survey_id"),
  filterJson: json("filter_json"),
  emailSubject: varchar("email_subject", { length: 500 }).notNull(),
  emailBody: text("email_body").notNull(),
  scheduleType: varchar("schedule_type", { length: 30 }).notNull().default("now"),
  scheduledAt: timestamp("scheduled_at"),
  recurringCron: varchar("recurring_cron", { length: 100 }),
  status: varchar("status", { length: 30 }).notNull().default("draft"),
  totalRecipients: int("total_recipients").default(0),
  sentCount: int("sent_count").default(0),
  failedCount: int("failed_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  sentAt: timestamp("sent_at"),
});

export const emailCampaignRecipients = mysqlTable("email_campaign_recipients", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaign_id").notNull(),
  userId: int("user_id").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  error: text("error"),
});

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = typeof emailCampaigns.$inferInsert;
export type EmailCampaignRecipient = typeof emailCampaignRecipients.$inferSelect;




// ─── Risk Assessment (Phase 4 — Análise de Risco Psicossocial NR-01) ──────────
export const psychosocialFactors = mysqlTable("psychosocial_factors", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  preventiveProgramModuleId: int("preventive_program_module_id"),
  defaultAction: text("default_action"),
  axisOrder: int("axis_order").default(0),
});

export const riskAssessments = mysqlTable("risk_assessments", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("company_id").notNull(),
  branchId: int("branch_id"),
  sectorId: int("sector_id"),
  cycleName: varchar("cycle_name", { length: 255 }).notNull(),
  drpsSurveyId: int("drps_survey_id"),
  aepSurveyId: int("aep_survey_id"),
  status: varchar("status", { length: 30 }).notNull().default("planning"),
  responsibleTechnician: varchar("responsible_technician", { length: 255 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  notes: text("notes"),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const riskInventoryItems = mysqlTable("risk_inventory_items", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessment_id").notNull(),
  factorId: int("factor_id").notNull(),
  gravidade: varchar("gravidade", { length: 30 }).notNull().default("baixa"),
  probabilidade: varchar("probabilidade", { length: 30 }).notNull().default("baixa"),
  riscoFinal: varchar("risco_final", { length: 30 }).notNull().default("baixo"),
  fontesGeradoras: text("fontes_geradoras"),
  medidasExistentes: text("medidas_existentes"),
  drpsScoreAvg: decimal("drps_score_avg", { precision: 4, scale: 2 }),
  drpsResponsesCount: int("drps_responses_count").default(0),
  aepObservations: text("aep_observations"),
  notes: text("notes"),
});

export const riskActionPlanItems = mysqlTable("risk_action_plan_items", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessment_id").notNull(),
  factorId: int("factor_id").notNull(),
  preventiveProgramModuleId: int("preventive_program_module_id"),
  actionDescription: text("action_description").notNull(),
  responsibleParty: varchar("responsible_party", { length: 255 }),
  priority: varchar("priority", { length: 30 }).default("baixa"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: varchar("status", { length: 30 }).default("programado"),
  monthlyProgress: json("monthly_progress"),
  notes: text("notes"),
});

export type PsychosocialFactor = typeof psychosocialFactors.$inferSelect;
export type RiskAssessment = typeof riskAssessments.$inferSelect;
export type InsertRiskAssessment = typeof riskAssessments.$inferInsert;
export type RiskInventoryItem = typeof riskInventoryItems.$inferSelect;
export type RiskActionPlanItem = typeof riskActionPlanItems.$inferSelect;

// ─── Appointment Scheduling ───────────────────────────────────────────────────
export const appointmentProfessionals = mysqlTable("appointment_professionals", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("company_id"),          // null = platform-wide professional
  userId: int("user_id"),                // FK to users if platform user
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  specialty: varchar("specialty", { length: 255 }),
  bio: text("bio"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appointmentAvailability = mysqlTable("appointment_availability", {
  id: int("id").autoincrement().primaryKey(),
  professionalId: int("professional_id").notNull(),
  dayOfWeek: tinyint("day_of_week").notNull(),  // 0=Sun..6=Sat
  startTime: varchar("start_time", { length: 5 }).notNull(),  // "08:00"
  endTime: varchar("end_time", { length: 5 }).notNull(),      // "17:00"
  slotDurationMinutes: int("slot_duration_minutes").default(30).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("company_id").notNull(),
  collaboratorId: int("collaborator_id").notNull(),  // FK to users
  professionalId: int("professional_id").notNull(),  // FK to appointment_professionals
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: int("duration_minutes").default(30).notNull(),
  status: varchar("status", { length: 30 }).default("pending").notNull(), // pending|confirmed|cancelled|completed
  meetingUrl: varchar("meeting_url", { length: 500 }),
  notes: text("notes"),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type AppointmentProfessional = typeof appointmentProfessionals.$inferSelect;
export type AppointmentAvailability = typeof appointmentAvailability.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;

// ─── Risk-Course Correlation ──────────────────────────────────────────────────
export const riskCourseLinks = mysqlTable("risk_course_links", {
  id: int("id").autoincrement().primaryKey(),
  factorId: int("factor_id").notNull(),    // FK to psychosocial_factors
  moduleId: int("module_id").notNull(),    // FK to modules
  criticality: varchar("criticality", { length: 20 }).default("alto").notNull(), // baixo|medio|alto|critico
  isAutoLinked: boolean("is_auto_linked").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type RiskCourseLink = typeof riskCourseLinks.$inferSelect;

