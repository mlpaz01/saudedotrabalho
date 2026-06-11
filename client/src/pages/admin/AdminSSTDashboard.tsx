import { useMemo } from "react"
import AppLayout from "@/components/AppLayout"
import { trpc } from "@/lib/trpc"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from "lucide-react"

const STATUS_LABELS: Record<string, string> = {
  programado: "Programado",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  atrasado: "Atrasado",
}

const STATUS_COLORS: Record<string, string> = {
  programado: "bg-blue-500",
  em_andamento: "bg-yellow-500",
  concluido: "bg-green-500",
  atrasado: "bg-red-500",
}

const PRIORITY_LABELS: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
}

const PRIORITY_ORDER = ["critica", "alta", "media", "baixa"]

export default function AdminSSTDashboard() {
  const { data: actionItems, isLoading: loadingActions } =
    trpc.riskAssessment.allActionItems.useQuery()

  const { data: modulesData, isLoading: loadingModules } =
    trpc.admin.listModules.useQuery(undefined, {
      staleTime: 60000,
    })

  const today = useMemo(() => new Date(), [])

  const kpis = useMemo(() => {
    if (!actionItems) return null

    const atrasadas = actionItems.filter((item: any) => {
      if (
        item.status === "concluido" ||
        item.status === "cancelado"
      )
        return false
      if (!item.endDate) return false
      return new Date(item.endDate) < today
    })

    const criticas = actionItems.filter(
      (item: any) =>
        item.priority === "critica" || item.priority === "alta"
    )

    const concluidas = actionItems.filter(
      (item: any) => item.status === "concluido"
    )

    const semCurso = actionItems.filter((item: any) => !item.moduleId)

    return { atrasadas, criticas, concluidas, semCurso }
  }, [actionItems, today])

  const statusCounts = useMemo(() => {
    if (!actionItems) return {}
    const counts: Record<string, number> = {
      programado: 0,
      em_andamento: 0,
      concluido: 0,
      atrasado: 0,
    }
    actionItems.forEach((item: any) => {
      const isAtrasado =
        item.status !== "concluido" &&
        item.status !== "cancelado" &&
        item.endDate &&
        new Date(item.endDate) < today
      if (isAtrasado) {
        counts.atrasado = (counts.atrasado || 0) + 1
      } else if (counts[item.status] !== undefined) {
        counts[item.status]++
      }
    })
    return counts
  }, [actionItems, today])

  const priorityStats = useMemo(() => {
    if (!actionItems) return []
    return PRIORITY_ORDER.map((priority) => {
      const items = actionItems.filter(
        (item: any) => item.priority === priority
      )
      const total = items.length
      const concluidas = items.filter(
        (item: any) => item.status === "concluido"
      ).length
      const pendentes = total - concluidas
      const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0
      return { priority, total, concluidas, pendentes, pct }
    })
  }, [actionItems])

  const totalActions = actionItems?.length ?? 0

  const isLoading = loadingActions || loadingModules

  const kpiCards = kpis
    ? [
        {
          label: "Ações Atrasadas",
          value: kpis.atrasadas.length,
          icon: <AlertTriangle className="w-6 h-6 text-red-500" />,
          bg: "bg-red-50",
          border: "border-red-200",
          text: "text-red-700",
        },
        {
          label: "Ações Críticas",
          value: kpis.criticas.length,
          icon: <ShieldAlert className="w-6 h-6 text-orange-500" />,
          bg: "bg-orange-50",
          border: "border-orange-200",
          text: "text-orange-700",
        },
        {
          label: "Ações Concluídas",
          value: kpis.concluidas.length,
          icon: <CheckCircle2 className="w-6 h-6 text-green-500" />,
          bg: "bg-green-50",
          border: "border-green-200",
          text: "text-green-700",
        },
        {
          label: "Sem Curso Vinculado",
          value: kpis.semCurso.length,
          icon: <Clock className="w-6 h-6 text-amber-500" />,
          bg: "bg-amber-50",
          border: "border-amber-200",
          text: "text-amber-700",
        },
      ]
    : []

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard Executivo SST
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Indicadores de Segurança e Saúde no Trabalho
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400 text-sm animate-pulse">
              Carregando dados...
            </div>
          </div>
        ) : !actionItems || actionItems.length === 0 ? (
          <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200">
            <div className="text-center text-gray-400">
              <p className="text-lg font-medium">Nenhuma ação encontrada</p>
              <p className="text-sm mt-1">
                Cadastre ações no Plano de Ação para visualizar os indicadores.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {kpiCards.map((card) => (
                <div
                  key={card.label}
                  className={`rounded-xl border p-5 flex items-center gap-4 ${card.bg} ${card.border}`}
                >
                  <div className="shrink-0">{card.icon}</div>
                  <div>
                    <p className={`text-2xl font-bold ${card.text}`}>
                      {card.value}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{card.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Bar Chart by Status */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">
                Distribuição por Status
              </h2>
              {Object.keys(STATUS_LABELS).every(
                (s) => (statusCounts[s] ?? 0) === 0
              ) ? (
                <p className="text-sm text-gray-400">
                  Sem dados de status disponíveis.
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => {
                    const count = statusCounts[key] ?? 0
                    const pct =
                      totalActions > 0
                        ? Math.round((count / totalActions) * 100)
                        : 0
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium">
                            {label}
                          </span>
                          <span className="text-gray-500">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div
                            className={`${STATUS_COLORS[key]} h-3 rounded-full transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Priority Table */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">
                Ações por Prioridade
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-3 pr-4 font-medium">Prioridade</th>
                      <th className="pb-3 pr-4 font-medium text-right">
                        Total
                      </th>
                      <th className="pb-3 pr-4 font-medium text-right">
                        Concluídas
                      </th>
                      <th className="pb-3 pr-4 font-medium text-right">
                        Pendentes
                      </th>
                      <th className="pb-3 font-medium text-right">
                        % Conclusão
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {priorityStats.map((row) => (
                      <tr key={row.priority} className="hover:bg-gray-50">
                        <td className="py-3 pr-4 font-medium text-gray-800">
                          {PRIORITY_LABELS[row.priority] ?? row.priority}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-600">
                          {row.total}
                        </td>
                        <td className="py-3 pr-4 text-right text-green-600 font-medium">
                          {row.concluidas}
                        </td>
                        <td className="py-3 pr-4 text-right text-red-500">
                          {row.pendentes}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                              row.pct >= 75
                                ? "bg-green-100 text-green-700"
                                : row.pct >= 40
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {row.pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fixed Text Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-3">
                Informações Regulatórias
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                O monitoramento contínuo do PGR ocorre através de indicadores
                técnicos e gerenciais relacionados à Segurança e Saúde no
                Trabalho.
              </p>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
