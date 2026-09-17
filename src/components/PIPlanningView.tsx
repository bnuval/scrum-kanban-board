'use client'

import { useState, useMemo } from 'react'
import {
  Layers,
  Sparkles,
  AlertTriangle,
  BookmarkCheck,
  Save,
  CheckCircle2,
  Calendar,
  Users,
  ShieldAlert,
  HelpCircle,
  EyeOff,
} from 'lucide-react'
import {
  updateFeatureTShirtSize,
  alignFeatureToTeam,
  savePIBaselinePlan,
  setFeatureRiskStatus,
} from '@/app/pi-actions'
import { TShirtSize, PlanRiskStatus } from '@prisma/client'

interface FeatureItem {
  id: string
  key: string
  title: string
  type: string
  tShirtSize: TShirtSize | null
  startSprintIdx: number
  endSprintIdx: number
  targetTeamId: string | null
  riskStatus: PlanRiskStatus
  riskNotes: string | null
  children?: any[]
  planBaselines?: any[]
}

interface TeamProject {
  id: string
  name: string
  key: string
}

interface PIPlanningViewProps {
  features: FeatureItem[]
  teams: TeamProject[]
  orgId: string
  isReadOnly?: boolean
}

const SPRINT_LABELS = ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5 (IP)']

const SIZE_CONFIG: Record<TShirtSize, { label: string; sprints: number; color: string }> = {
  XS: { label: 'X-Small (1 Sprint)', sprints: 1, color: 'bg-emerald-500' },
  S: { label: 'Small (2 Sprints)', sprints: 2, color: 'bg-teal-500' },
  M: { label: 'Medium (3 Sprints)', sprints: 3, color: 'bg-blue-500' },
  L: { label: 'Large (4 Sprints)', sprints: 4, color: 'bg-amber-500' },
  XL: { label: 'Extra Large (>4 Sprints)', sprints: 5, color: 'bg-rose-500' },
}

export default function PIPlanningView({
  features: initialFeatures,
  teams,
  orgId,
  isReadOnly = false,
}: PIPlanningViewProps) {
  const [features, setFeatures] = useState<FeatureItem[]>(initialFeatures)
  const [selectedPI, setSelectedPI] = useState('PI-2026-Q4')
  const [savingBaseline, setSavingBaseline] = useState(false)
  const [activeRiskModal, setActiveRiskModal] = useState<FeatureItem | null>(null)
  const [riskNoteText, setRiskNoteText] = useState('')

  // Sizing change with instant Gantt re-computation
  const handleSizeChange = async (featureId: string, newSize: TShirtSize) => {
    if (isReadOnly) return
    const feature = features.find((f) => f.id === featureId)
    if (!feature) return

    const sprintsNeeded = SIZE_CONFIG[newSize].sprints
    const newEnd = feature.startSprintIdx + sprintsNeeded - 1

    setFeatures((prev) =>
      prev.map((f) =>
        f.id === featureId
          ? { ...f, tShirtSize: newSize, endSprintIdx: newEnd }
          : f
      )
    )

    await updateFeatureTShirtSize(featureId, newSize, feature.startSprintIdx)
  }

  // Start Sprint change
  const handleStartSprintChange = async (featureId: string, newStart: number) => {
    if (isReadOnly) return
    const feature = features.find((f) => f.id === featureId)
    if (!feature || !feature.tShirtSize) return

    const sprintsNeeded = SIZE_CONFIG[feature.tShirtSize].sprints
    const newEnd = newStart + sprintsNeeded - 1

    setFeatures((prev) =>
      prev.map((f) =>
        f.id === featureId
          ? { ...f, startSprintIdx: newStart, endSprintIdx: newEnd }
          : f
      )
    )

    await updateFeatureTShirtSize(featureId, feature.tShirtSize, newStart)
  }

  // Team alignment change
  const handleTeamChange = async (featureId: string, teamId: string) => {
    if (isReadOnly) return
    setFeatures((prev) =>
      prev.map((f) => (f.id === featureId ? { ...f, targetTeamId: teamId } : f))
    )
    await alignFeatureToTeam(featureId, teamId)
  }

  // Freeze planned baseline
  const handleFreezePlan = async () => {
    setSavingBaseline(true)
    const res = await savePIBaselinePlan(selectedPI, orgId)
    setSavingBaseline(false)
    if (res.success) {
      alert(`Frozen ${res.count} features to baseline "${selectedPI}". You can now compare real-time execution drift.`)
    }
  }

  // Save Risk Status
  const handleSetRisk = async (status: PlanRiskStatus) => {
    if (!activeRiskModal) return
    await setFeatureRiskStatus(activeRiskModal.id, status, riskNoteText)
    setFeatures((prev) =>
      prev.map((f) =>
        f.id === activeRiskModal.id
          ? { ...f, riskStatus: status, riskNotes: riskNoteText }
          : f
      )
    )
    setActiveRiskModal(null)
    setRiskNoteText('')
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Snapshot Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs uppercase text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
              SAFe Program Increment
            </span>
            <h2 className="text-base font-bold text-slate-900">
              PI Planning & Team Gantt Roadmap
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Size epics & features in T-Shirt sizes. Gantt projections adjust automatically based on team capacity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={selectedPI}
            onChange={(e) => setSelectedPI(e.target.value)}
            className="text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
          />

          {!isReadOnly && (
            <button
              type="button"
              onClick={handleFreezePlan}
              disabled={savingBaseline}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {savingBaseline ? 'Freezing...' : 'Save Baseline Plan'}
            </button>
          )}
        </div>
      </div>

      {/* Split Workstation: Left Editor & Right Gantt Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Side: Feature Sizing Table */}
        <div className="xl:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Features & Capacity Sizing
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">
              {features.length} Features
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[750px] pr-1">
            {features.map((feature) => {
              const latestBaseline = feature.planBaselines?.[0]
              const hasSlipped =
                latestBaseline &&
                feature.endSprintIdx > latestBaseline.endSprintIdx &&
                feature.riskStatus !== 'IGNORED'

              return (
                <div
                  key={feature.id}
                  className={`p-3 rounded-lg border text-xs space-y-2.5 transition ${
                    hasSlipped
                      ? 'border-red-300 bg-red-50/20 ring-1 ring-red-300'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-mono text-[11px] font-bold text-slate-700">
                        {feature.key}
                      </span>
                      <span className="font-semibold text-slate-800 truncate" title={feature.title}>
                        {feature.title}
                      </span>
                    </div>

                    {hasSlipped && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRiskModal(feature)
                          setRiskNoteText(feature.riskNotes || '')
                        }}
                        className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded cursor-pointer hover:bg-red-200"
                        title="Click to manage risk"
                      >
                        <AlertTriangle className="w-3 h-3" /> Behind Schedule
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* T-Shirt Size Picker */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        T-Shirt Size
                      </label>
                      <select
                        disabled={isReadOnly}
                        value={feature.tShirtSize || ''}
                        onChange={(e) =>
                          handleSizeChange(feature.id, e.target.value as TShirtSize)
                        }
                        className="w-full text-xs font-semibold p-1.5 border border-slate-300 rounded bg-slate-50 focus:outline-none cursor-pointer"
                      >
                        <option value="">Unsized</option>
                        <option value="XS">XS (1 Sprint)</option>
                        <option value="S">S (2 Sprints)</option>
                        <option value="M">M (3 Sprints)</option>
                        <option value="L">L (4 Sprints)</option>
                        <option value="XL">XL (&gt;4 Sprints)</option>
                      </select>
                    </div>

                    {/* Delivering Team */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Target Team
                      </label>
                      <select
                        disabled={isReadOnly}
                        value={feature.targetTeamId || ''}
                        onChange={(e) => handleTeamChange(feature.id, e.target.value)}
                        className="w-full text-xs font-semibold p-1.5 border border-slate-300 rounded bg-slate-50 focus:outline-none cursor-pointer"
                      >
                        <option value="">Unassigned</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.key})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Start Sprint Index */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Start Iteration
                      </label>
                      <select
                        disabled={isReadOnly || !feature.tShirtSize}
                        value={feature.startSprintIdx}
                        onChange={(e) =>
                          handleStartSprintChange(feature.id, Number(e.target.value))
                        }
                        className="w-full text-xs font-semibold p-1.5 border border-slate-300 rounded bg-slate-50 focus:outline-none cursor-pointer"
                      >
                        {SPRINT_LABELS.map((label, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Side: Visual Gantt Chart Roadmap */}
        <div className="xl:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-4 overflow-x-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              PI Timeline & Program Board (5 Sprints)
            </h3>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Active Plan
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full border border-dashed border-slate-400 bg-slate-200" /> Frozen Baseline
              </span>
            </div>
          </div>

          {/* Gantt Timeline Headers */}
          <div className="min-w-[500px]">
            <div className="grid grid-cols-5 gap-2 border-b border-slate-200 pb-2 text-center text-xs font-bold text-slate-600">
              {SPRINT_LABELS.map((lbl, idx) => (
                <div key={idx} className="bg-slate-100/80 py-1 rounded">
                  {lbl}
                </div>
              ))}
            </div>

            {/* Gantt Bars by Team */}
            <div className="divide-y divide-slate-100 pt-2 space-y-3">
              {teams.map((team) => {
                const teamFeatures = features.filter((f) => f.targetTeamId === team.id)
                if (teamFeatures.length === 0) return null

                return (
                  <div key={team.id} className="pt-2 space-y-2">
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>{team.name}</span>
                      <span className="font-mono text-slate-400 font-normal">({team.key})</span>
                    </div>

                    <div className="space-y-2 pl-4">
                      {teamFeatures.map((f) => {
                        if (!f.tShirtSize) return null
                        const config = SIZE_CONFIG[f.tShirtSize]
                        const start = Math.min(Math.max(f.startSprintIdx, 1), 5)
                        const span = Math.min(config.sprints, 6 - start)

                        // Check baseline variance
                        const baseline = f.planBaselines?.[0]
                        const hasSlipped = baseline && f.endSprintIdx > baseline.endSprintIdx

                        return (
                          <div key={f.id} className="space-y-1">
                            {/* Visual Gantt Bar */}
                            <div className="grid grid-cols-5 gap-2 items-center relative py-1">
                              {/* Background grid lines */}
                              <div className="absolute inset-0 grid grid-cols-5 gap-2 pointer-events-none opacity-10">
                                {SPRINT_LABELS.map((_, i) => (
                                  <div key={i} className="border-r border-slate-400 h-full" />
                                ))}
                              </div>

                              <div
                                style={{
                                  gridColumnStart: start,
                                  gridColumnEnd: `span ${span}`,
                                }}
                                className={`h-7 rounded-md ${config.color} text-white px-2 flex items-center justify-between text-xs font-bold shadow-xs transition-all z-10`}
                              >
                                <span className="truncate">
                                  {f.key}: {f.title}
                                </span>
                                <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded ml-1 shrink-0">
                                  {f.tShirtSize} ({config.sprints}S)
                                </span>
                              </div>
                            </div>

                            {/* Frozen Baseline Ghost Bar (if plan shifted) */}
                            {baseline && (
                              <div className="grid grid-cols-5 gap-2 items-center relative">
                                <div
                                  style={{
                                    gridColumnStart: baseline.startSprintIdx,
                                    gridColumnEnd: `span ${SIZE_CONFIG[baseline.tShirtSize as TShirtSize]?.sprints || 1}`,
                                  }}
                                  className="h-3 rounded border border-dashed border-slate-400 bg-slate-200/60 z-0"
                                  title={`Frozen Baseline: Sprints ${baseline.startSprintIdx} - ${baseline.endSprintIdx}`}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {features.filter((f) => f.tShirtSize && f.targetTeamId).length === 0 && (
                <div className="p-12 text-center text-xs text-slate-400 italic">
                  Select T-Shirt sizes and assign delivering teams on the left to project the timeline.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slippage & Risk Resolution Modal */}
      {activeRiskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
              <ShieldAlert className="w-5 h-5" />
              <span>Execution Slippage Notification</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Feature <span className="font-bold text-slate-900">{activeRiskModal.key} ({activeRiskModal.title})</span> was originally scheduled to complete by{' '}
              <span className="font-bold text-slate-900">Sprint {activeRiskModal.planBaselines?.[0]?.endSprintIdx}</span>, but capacity re-sizing extends it into{' '}
              <span className="font-bold text-red-600">Sprint {activeRiskModal.endSprintIdx}</span>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Risk Mitigation / Notes
              </label>
              <textarea
                rows={3}
                value={riskNoteText}
                onChange={(e) => setRiskNoteText(e.target.value)}
                placeholder="Document cause (e.g., cross-team backend dependency, staffing shortfall)..."
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleSetRisk(PlanRiskStatus.IGNORED)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Ignore Drift
              </button>
              <button
                type="button"
                onClick={() => handleSetRisk(PlanRiskStatus.AT_RISK)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
              >
                Flag as At Risk
              </button>
              <button
                type="button"
                onClick={() => handleSetRisk(PlanRiskStatus.CRITICAL)}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                Flag Critical
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}