import { Link } from 'react-router-dom';

export default function Introuvable() {
  return (
    <main className="conteneur contenu introuvable">
      <h1>Page introuvable</h1>
      <p><Link to="/">Retour à l’accueil</Link></p>
    </main>
  );
}
