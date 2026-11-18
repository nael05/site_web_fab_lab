// Affichage d'une note (lecture) ou sélecteur accessible (boutons radio)
export function Etoiles({ note }) {
  return (
    <span className="etoiles" role="img" aria-label={`${note} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= note ? 'etoile etoile--pleine' : 'etoile'} aria-hidden="true">★</span>
      ))}
    </span>
  );
}

export function ChoixEtoiles({ valeur, onChange }) {
  return (
    <fieldset className="choix-etoiles">
      <legend>Note <span className="obligatoire" aria-hidden="true">*</span></legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={n <= valeur ? 'etoile etoile--pleine' : 'etoile'}>
          <input
            type="radio"
            name="note"
            value={n}
            checked={valeur === n}
            onChange={() => onChange(n)}
            className="visuellement-cache"
            required
          />
          <span aria-hidden="true">★</span>
          <span className="visuellement-cache">{n} sur 5</span>
        </label>
      ))}
    </fieldset>
  );
}
