const { Client } = require('pg');

async function test() {
  const client = new Client({
    connectionString: "postgres://postgres:postgres@localhost:5432/memora"
  });
  await client.connect();
  const res = await client.query('SELECT id, email FROM users');
  console.log(res.rows);
  await client.end();
}
test();
