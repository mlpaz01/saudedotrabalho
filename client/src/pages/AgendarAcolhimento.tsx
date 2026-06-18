import { useState } from "react";
import { Link } from "wouter";
import { Calendar, Clock, HeartHandshake, Lock, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AgendarAcolhimento() {
  const eligibilityQ = trpc.scheduling.myEligibility.useQuery();
  const profQ = trpc.scheduling.listProfessionals.useQuery({}, { enabled: eligibilityQ.data?.eligible === true });
  const [profId, setProfId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const slotsQ = trpc.scheduling.getAvailableSlots.useQuery(
    { professionalId: profId ?? 0, date },
    { enabled: !!profId && !!date }
  );
  const availDatesQ = trpc.scheduling.getAvailableDates.useQuery(
    { professionalId: profId ?? 0, daysAhead: 45 },
    { enabled: !!profId }
  );
  const bookMut = trpc.scheduling.bookAppointment.useMutation({
    onSuccess: () => {
      toast.success("Conversa agendada com sucesso. Você receberá uma notificação com a confirmação.");
      setProfId(null); setDate(""); setTime(""); setNotes("");
    },
    onError: (e) => toast.error(e.message),
  });

  const elig = eligibilityQ.data;
  const profs: any[] = profQ.data ?? [];
  const slots: string[] = slotsQ.data ?? [];

  if (eligibilityQ.isLoading) {
    return <AppLayout><div className="p-8 text-sm text-muted-foreground">Carregando…</div></AppLayout>;
  }

  if (!elig?.eligible) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto p-6 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Link href="/inicio" className="hover:underline flex items-center gap-1"><ArrowLeft size={14} /> Voltar ao início</Link>
          </div>
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                <Lock size={28} />
              </div>
              <h1 className="text-xl font-bold">Programa de Acolhimento Psicológico</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {elig?.message ?? "Agendamento psicológico disponível apenas para colaboradores com indicação de acompanhamento ou pertencentes a grupos monitorados pela plataforma."}
              </p>
              <p className="text-xs text-muted-foreground">
                Em caso de necessidade, entre em contato com o RH ou utilize o Canal de Suporte.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  function handleBook() {
    if (!profId || !date || !time) { toast.error("Preencha profissional, data e horário."); return; }
    bookMut.mutate({ professionalId: profId, date, time, notes: notes || undefined });
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Link href="/inicio" className="hover:underline flex items-center gap-1"><ArrowLeft size={14} /> Voltar ao início</Link>
        </div>

        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-5 flex gap-3 items-start">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <HeartHandshake size={20} />
            </div>
            <div>
              <h1 className="font-bold text-emerald-900">Programa de Acolhimento Psicológico</h1>
              <p className="text-sm text-emerald-900/80 mt-1">{elig.message}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold text-lg">Solicitar agendamento</h2>

            <div>
              <Label>Profissional</Label>
              <Select value={profId?.toString() ?? ""} onValueChange={(v) => { setProfId(Number(v)); setTime(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar profissional…" /></SelectTrigger>
                <SelectContent>
                  {profs.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}{p.specialty ? ` — ${p.specialty}` : ""}
                    </SelectItem>
                  ))}
                  {profs.length === 0 && (
                    <SelectItem value="none" disabled>Nenhum profissional disponível</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {profId && (
              <div>
                <Label>Datas disponíveis</Label>
                {availDatesQ.isLoading ? (
                  <p className="text-xs text-muted-foreground mt-1">Carregando datas…</p>
                ) : (availDatesQ.data ?? []).length === 0 ? (
                  <p className="text-xs text-amber-700 mt-1">Este profissional ainda não publicou disponibilidade.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {(availDatesQ.data ?? []).slice(0, 18).map((d) => {
                      const dt = new Date(d + "T00:00:00");
                      const label = dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => { setDate(d); setTime(""); }}
                          className={`text-xs px-3 py-1.5 rounded border ${date === d ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:border-primary/40"}`}
                        >{label}</button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {profId && date && (
              <div>
                <Label>Horário disponível</Label>
                {slotsQ.isLoading ? (
                  <p className="text-xs text-muted-foreground mt-1">Carregando horários…</p>
                ) : slots.length === 0 ? (
                  <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                    <Clock size={12} /> Nenhum horário disponível neste dia para o profissional selecionado.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {slots.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setTime(s)}
                        className={`text-sm py-2 rounded border ${time === s ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:border-primary/40"}`}
                      >{s}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Observação (opcional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Algo que você queira informar antes da conversa?" />
            </div>

            <Button className="w-full gap-2" onClick={handleBook} disabled={bookMut.isPending || !profId || !date || !time}>
              <Calendar size={16} />
              {bookMut.isPending ? "Agendando…" : "Confirmar agendamento"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
