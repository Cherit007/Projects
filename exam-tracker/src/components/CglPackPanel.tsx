import { useState } from 'react'
import {
  CGL_CORE_OPTIONS,
  CGL_PATH_IDS,
  examsForCglPack,
  type CglCoreId,
} from '../data/cglPack'
import { EXAM_BY_ID } from '../data/exams'
import { useCglPack } from '../hooks/usePrepSettings'
import { replaceProgressState, useProgress } from '../hooks/useProgress'
import { showToast } from '../utils/toastBus'

export function CglPackPanel() {
  const [pack, setPack] = useCglPack()
  const { starred, exportState } = useProgress()
  const [applied, setApplied] = useState(false)

  const applyPack = () => {
    const want = new Set(examsForCglPack(pack))
    const state = exportState()
    const nextStars = new Set(state.starred)
    for (const id of CGL_PATH_IDS) nextStars.delete(id)
    for (const id of want) nextStars.add(id)

    replaceProgressState({
      ...state,
      starred: [...nextStars],
      deprioritized: state.deprioritized.filter((id) => !nextStars.has(id)),
    })

    const labels = [...want]
      .map((id) => EXAM_BY_ID[id]?.shortName ?? id)
      .join(' · ')
    showToast(`CGL pack starred: ${labels}`)
    setApplied(true)
  }

  return (
    <section className="cgl-pack" aria-label="SSC CGL preference pack">
      <div className="section-head">
        <h2>CGL preference pack</h2>
        {applied && <span className="soft-chip reg-open-chip">Applied</span>}
      </div>
      <p className="muted-line plan-intro">
        Pick one core post path. Optionally add AAO Paper-III (Finance &amp;
        Economics) without dropping your core preference.
      </p>
      <div className="cgl-core-grid" role="radiogroup" aria-label="Core CGL path">
        {CGL_CORE_OPTIONS.map((opt) => (
          <label
            key={opt.id}
            className={`cgl-core-option${pack.core === opt.id ? ' selected' : ''}`}
          >
            <input
              type="radio"
              name="cgl-core"
              checked={pack.core === opt.id}
              onChange={() =>
                setPack({
                  core: opt.id as CglCoreId,
                  aaoAddon: opt.id === 'ssccglaao' ? false : pack.aaoAddon,
                })
              }
            />
            <span>
              <strong>{opt.label}</strong>
              <em>{opt.blurb}</em>
            </span>
          </label>
        ))}
      </div>
      <label className="foundation-lock cgl-addon">
        <input
          type="checkbox"
          checked={pack.aaoAddon && pack.core !== 'ssccglaao'}
          disabled={pack.core === 'ssccglaao'}
          onChange={(e) =>
            setPack({ ...pack, aaoAddon: e.target.checked })
          }
        />
        <span>
          AAO Paper-III add-on — also star SSC AAO syllabus (Finance &amp;
          Economics)
          {pack.core === 'ssccglaao' ? ' · already your core' : ''}
        </span>
      </label>
      <div className="cgl-pack-actions">
        <button type="button" className="btn primary" onClick={applyPack}>
          Star this pack
        </button>
        <span className="muted-line">
          Currently starred:{' '}
          {starred.filter((id) => CGL_PATH_IDS.has(id)).length
            ? starred
                .filter((id) => CGL_PATH_IDS.has(id))
                .map((id) => EXAM_BY_ID[id]?.shortName ?? id)
                .join(', ')
            : 'none'}
        </span>
      </div>
    </section>
  )
}
