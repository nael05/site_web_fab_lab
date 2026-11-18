// Suivi d'un projet : étapes + (3D en impression) jauge % et compte à rebours
import { useEffect, useState } from 'react';

const ETAPES = {
  impression_3d: [
    ['soumis', 'Soumis'],
    ['accepte', 'Accepté'],
    ['en_impression', 'Impression'],
    ['en_finition', 'Finition'],
    ['pret', 'Prêt'],
    ['termine', 'Terminé'],
  ],
  tee_shirt: [
    ['soumis', 'Soumis'],
    ['accepte', 'Accepté'],
    ['en_preparation', 'Préparation'],
    ['pret', 'Prêt'],
    ['termine', 'Terminé'],
  ],
};

// Re-rendu chaque seconde (pour le compte à rebours)
function useMaintenant(actif) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!actif) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [actif]);
  return now;
}

// % saisi par l'admin (ou Bambu Lab) en priorité, sinon calculé avec l'heure de fin prévue
function pourcentage(p, now) {
  if (p.progression_pct != null) return p.progression_pct;
  if (!p.debut_impression || !p.fin_impression_prevue) return null;
  const debut = new Date(p.debut_impression).getTime();
  const fin = new Date(p.fin_impression_prevue).getTime();
  return Math.min(100, Math.max(0, Math.round(((now - debut) / (fin - debut)) * 100)));
}

function rebours(ms) {
  if (ms <= 0) return 'Bientôt fini';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
}

export default function SuiviProjet({ projet }) {
  const enImpression = projet.categorie === 'impression_3d' && projet.statut === 'en_impression';
  const now = useMaintenant(enImpression);

  if (projet.statut === 'refuse') {
    return (
      <p className="alerte alerte--erreur">
        Projet refusé{projet.motif_refus ? ` : ${projet.motif_refus}` : '.'}
      </p>
    );
  }

  const etapes = ETAPES[projet.categorie];
  const index = etapes.findIndex(([s]) => s === projet.statut);
  const pct = enImpression ? pourcentage(projet, now) : null;
  const reste = projet.fin_impression_prevue ? new Date(projet.fin_impression_prevue).getTime() - now : null;

  return (
    <div className="suivi">
      <ol className="etapes" aria-label="Avancement du projet">
        {etapes.map(([statut, label], i) => (
          <li
            key={statut}
            className={i < index ? 'etape etape--faite' : i === index ? 'etape etape--courante' : 'etape'}
            aria-current={i === index ? 'step' : undefined}
          >
            <span className="etape__point" aria-hidden="true">{i < index ? '✓' : i + 1}</span>
            <span className="etape__label">{label}</span>
          </li>
        ))}
      </ol>
      {/* Mobile : libellés masqués, on affiche l'étape en cours en texte */}
      <p className="etapes__mobile" aria-hidden="true">
        Étape {index + 1}/{etapes.length} : <strong>{etapes[index]?.[1]}</strong>
      </p>

      {enImpression && (
        <div className="impression">
          {pct != null && (
            <div className="jauge">
              <div className="jauge__entete">
                <span id={`jauge-${projet.id_projet}`}>Impression en cours</span>
                <strong>{pct} %</strong>
              </div>
              <div
                className="jauge__barre"
                role="progressbar"
                aria-labelledby={`jauge-${projet.id_projet}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <div className="jauge__rempli" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          {reste != null && (
            <p className="rebours">
              Temps restant : <span role="timer">{rebours(reste)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
