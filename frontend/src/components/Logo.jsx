// Logo "ynov fab lab" (réutilisable côté admin)
export default function Logo({ sousTitre = 'Fab Lab' }) {
  return (
    <span className="logo">
      <span className="logo__ynov">ynov</span>
      <span className="logo__sep" aria-hidden="true" />
      <span className="logo__lab">{sousTitre}</span>
    </span>
  );
}
