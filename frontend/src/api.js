// Appels au back. Le cookie de session part tout seul (même origine via le proxy Vite).
//   api('/projets/mes')
//   api('/avis', { method: 'POST', body: { ... } })
//   api('/projets', { method: 'POST', form: formData })   // avec fichiers
export async function api(url, { method = 'GET', body, form } = {}) {
  const options = { method, credentials: 'include', headers: {} };
  if (form) {
    options.body = form;
  } else if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`/api${url}`, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.erreur || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}
