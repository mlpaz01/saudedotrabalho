import dotenv from "dotenv";
dotenv.config({ path: "/var/www/saudedotrabalho/.env" });

const start = async () => {
  const mysql = await import("mysql2/promise");
  const url = new URL(process.env.DATABASE_URL.replace("mysql://","http://"));
  const conn = await mysql.createConnection({
    host: url.hostname,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//,"")
  });

  const [companies] = await conn.execute("SELECT * FROM companies WHERE id=1");
  console.log("companies:", companies.length);

  const [branches] = await conn.execute("SELECT id, company_id AS companyId, name FROM branches WHERE company_id IN (1)");
  console.log("branches:", branches.length);

  const [sectors] = await conn.execute("SELECT id, company_id AS companyId, branch_id AS branchId, name FROM sectors WHERE company_id IN (1)");
  console.log("sectors:", sectors.length);

  const [users] = await conn.execute("SELECT u.id, u.name, u.company_id AS companyId, u.branch_id AS branchId, u.sector_id AS sectorId FROM users u WHERE u.company_id IN (1)");
  console.log("users:", users.length);

  const usersByBranch = new Map();
  for (const u of users) {
    const key = String(u.companyId) + ":" + (u.branchId ?? 0) + ":" + (u.sectorId ?? 0);
    if (!usersByBranch.has(key)) usersByBranch.set(key, []);
    usersByBranch.get(key).push(u);
  }
  console.log("user keys:", [...usersByBranch.keys()]);

  // Simulate the tree building
  const co = companies[0];
  const cBranches = branches.filter(b => Number(b.companyId) === co.id);
  console.log("cBranches:", cBranches.length, cBranches.map(b => b.name));

  // Orphan users (no branch) - the logic
  const noBranchUsersBySector = new Map();
  for (const [key, list] of usersByBranch.entries()) {
    const parts = key.split(":").map(v => Number(v));
    const cid = parts[0], bid = parts[1], sid = parts[2];
    console.log("checking key", key, "cid=" + cid, "co.id=" + co.id, "bid=" + bid);
    if (cid !== co.id || bid !== 0) continue;
    noBranchUsersBySector.set(sid, list);
  }
  console.log("noBranchUsersBySector size:", noBranchUsersBySector.size);

  await conn.end();
};
start().catch(e => console.error("ERR:", e.message));
