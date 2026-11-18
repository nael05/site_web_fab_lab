// Connexion PostgreSQL (pool partagé)
import pg from 'pg';
import { config } from './config.js';

// NUMERIC (quantités) renvoyé en nombre JS au lieu d'une string
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
// DATE renvoyée telle quelle ('2026-11-09'), sans décalage de fuseau
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

// Requête simple : const { rows } = await query('SELECT ... WHERE id = $1', [id])
export const query = (text, params) => pool.query(text, params);

// Transaction : await transaction(async (client) => { await client.query(...) })
// Tout est annulé (ROLLBACK) si une erreur est levée dedans.
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultat = await fn(client);
    await client.query('COMMIT');
    return resultat;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
