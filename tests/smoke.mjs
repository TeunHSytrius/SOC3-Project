import assert from "node:assert/strict";
const base = process.env.SOC_URL || "http://localhost:8081";
class Client {
  cookies = new Map();
  async request(
    path,
    { method = "GET", body, headers = {}, csrf = true } = {},
  ) {
    if (
      csrf &&
      ["POST", "PATCH"].includes(method) &&
      path !== "auth/csrf"
    ) {
      const csrfResponse = await this.request("auth/csrf");
      headers = { ...headers, "X-CSRF-TOKEN": csrfResponse.data.token };
    }
    const response = await fetch(`${base}/api/v1/${path}`, {
      method,
      headers: {
        ...headers,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const eq = pair.indexOf("=");
      const key = pair.slice(0, eq);
      if (/max-age=0/i.test(cookie) || !pair.slice(eq + 1))
        this.cookies.delete(key);
      else this.cookies.set(key, pair.slice(eq + 1));
    }
    const raw = await response.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      /* Host filtering and proxies can return non-JSON errors. */
    }
    return {
      status: response.status,
      data,
      diagnostic: data === null ? raw.slice(0, 500) : undefined,
    };
  }
  async ok(path, opts = {}) {
    const { status, data, diagnostic } = await this.request(path, opts);
    assert(
      status >= 200 && status < 300,
      `${path}: ${status} ${diagnostic ?? JSON.stringify(data)}`,
    );
    assert(data !== null, `${path}: JSON verwacht`);
    return data;
  }
  post(path, body = {}) {
    return this.ok(path, { method: "POST", body });
  }
  login(role) {
    return this.post("auth/login", {
      username: `${role}@soc.demo`,
      password: "Demo2026!",
    });
  }
}
const guest = new Client();
await guest.ok("health");
const denied = await guest.request("users");
assert.equal(denied.status, 401);
assert(
  denied.data.message && denied.data.traceId,
  "401 must explain failure and include trace ID",
);
const admin = new Client();
await admin.login("beheerder");
const orgs = await admin.ok("organizations");
assert(orgs.length >= 3);
const errors = await admin.ok("errors");
assert(
  errors.some((e) => e.traceId === denied.data.traceId && e.status === 401),
);
assert(errors.every((e) => !("body" in e) && !("headers" in e)));
// Group accounts are seeded once; their role/profile can be changed through user management.
const teamUsers = await admin.ok("users");
for (const email of [
  "teun@soc.demo",
  "dominique@soc.demo",
  "sergio@soc.demo",
  "hamza@soc.demo",
  "ruben@soc.demo",
  "thijs@soc.demo",
])
  assert(
    teamUsers.some((u) => u.email === email),
    `Demoaccount ontbreekt: ${email}`,
  );
assert(
  !teamUsers.some((u) => u.email === "riza@soc.demo" && u.isActive),
  "Voormalig groepsaccount mag niet actief zijn",
);
const north = orgs.find((o) => o.name === "Northstar Finance");
const delta = orgs.find((o) => o.name === "Delta Logistics");
assert(north && delta);
const analyst = new Client();
await analyst.login("analist");
assert.equal((await analyst.request("errors")).status, 403);
assert.equal(
  (
    await analyst.request("auth/me", {
      headers: { "X-SOC-User": "00000000-0000-0000-0000-000000000000" },
    })
  ).status,
  401,
  "Wrong tab identity must not use the shared cookie",
);
const customer = new Client();
await customer.login("klant");
assert.equal((await customer.request("users")).status, 403);
assert.equal((await customer.request("organizations/" + delta.id)).status, 404);

// Account management: a separate test account preserves the seeded demo accounts.
const unique = Date.now();
const created = await admin.post("users", {
  name: "Accounttest",
  email: `accounttest-${unique}@soc.demo`,
  password: " TestAccount2026! ",
  role: "Klant",
  organizationIds: [north.id],
});
const createdClient = new Client();
await createdClient.post("auth/login", {
  username: `accounttest-${unique}@soc.demo`,
  password: " TestAccount2026! ",
});
assert.equal((await createdClient.ok("auth/me")).id, created.id);
const update = {
  name: "Accounttest gewijzigd",
  email: `accounttest-edit-${unique}@soc.demo`,
  role: "Accountmanager",
  organizationIds: [delta.id],
  isActive: true,
};
assert.equal(
  (
    await customer.request(`users/${created.id}`, {
      method: "PATCH",
      body: update,
    })
  ).status,
  403,
);
const edited = await admin.ok(`users/${created.id}`, {
  method: "PATCH",
  body: { ...update, password: " NewAccount2026! " },
});
assert.equal(edited.name, update.name);
assert.equal(edited.email, update.email);
assert.equal(edited.role, "Accountmanager");
assert.deepEqual(edited.organizationIds, [delta.id]);
assert.equal(edited.isActive, true);
const editedClient = new Client();
assert.equal(
  (
    await editedClient.request("auth/login", {
      method: "POST",
      body: { username: update.email, password: "TestAccount2026!" },
    })
  ).status,
  401,
);
await editedClient.post("auth/login", {
  username: update.email,
  password: " NewAccount2026! ",
});
assert.equal((await editedClient.ok("organizations"))[0].id, delta.id);
await admin.ok(`users/${created.id}`, {
  method: "PATCH",
  body: { ...update, isActive: false },
});
assert.equal((await editedClient.request("auth/me")).status, 401);
const inactiveClient = new Client();
assert.equal(
  (
    await inactiveClient.request("auth/login", {
      method: "POST",
      body: { username: update.email, password: " NewAccount2026! " },
    })
  ).status,
  401,
);
await admin.ok(`users/${created.id}`, { method: "PATCH", body: update });
await inactiveClient.post("auth/login", {
  username: update.email,
  password: " NewAccount2026! ",
});
await admin.ok(`users/${created.id}`, {
  method: "PATCH",
  body: { ...update, isActive: false },
});
assert(
  (await admin.ok("audit")).some(
    (a) =>
      a.action === "Gebruikersaccount gewijzigd" && a.target === created.id,
  ),
);

// Organization rename uses the same stable tenant ID and does not reprovision its schema.
const temporaryOrg = await admin.post("organizations", {
  name: "Tijdelijke klant " + unique,
});
const renamed = await admin.ok(`organizations/${temporaryOrg.id}`, {
  method: "PATCH",
  body: { name: "Hernoemde klant " + unique },
});
assert.equal(renamed.id, temporaryOrg.id);
assert.equal(renamed.name, "Hernoemde klant " + unique);
await admin.post(`organizations/${temporaryOrg.id}/deactivate`);
assert.equal(
  (await admin.ok(`organizations/${temporaryOrg.id}`)).isActive,
  false,
);
const removable = await admin.post("users", {
  name: "Verwijdertest",
  email: "remove-" + unique + "@soc.demo",
  password: "TestAccount2026!",
  role: "Klant",
  organizationIds: [north.id],
});
const removedSession = new Client();
await removedSession.post("auth/login", {
  username: removable.email,
  password: "TestAccount2026!",
});
assert.equal(
  (
    await customer.request("users/" + removable.id + "/remove", {
      method: "POST",
      body: {},
    })
  ).status,
  403,
);
await admin.post("users/" + removable.id + "/remove", {});
assert(!(await admin.ok("users")).some((u) => u.id === removable.id));
assert.equal((await removedSession.request("auth/me")).status, 401);
assert(
  (await admin.ok("audit")).some(
    (a) => a.action === "Gebruiker verwijderd" && a.target === removable.id,
  ),
);
// Tenant isolation and current workspace assignments.
const customerOrganizations = await customer.ok("organizations");
assert.deepEqual(customerOrganizations.map((organization) => organization.id), [north.id]);
const access = await customer.ok("me/access");
assert(access.workspaces.length > 0);
assert(access.workspaces.every((workspace) => workspace.workspaceId === north.id));
assert.equal((await customer.request("audit")).status, 403);
assert.equal((await admin.request("organizations", {
  method: "POST", csrf: false, body: { name: "Forbidden without CSRF" },
})).status, 400);

// Later sprint functionality must be absent from the API, not only hidden in the menu.
for (const path of ["alerts", "cases", "keys", "portal/cases", "ticket-register"]) {
  assert.equal((await admin.request(path)).status, 404, path);
}
assert.equal((await guest.request("ingest/alerts", { method: "POST", body: {} })).status, 404);
await customer.post("auth/logout");
assert.equal((await customer.request("auth/me")).status, 401);
console.log("PASS: Sprint 1 login/logout, accountbeheer, klantbeheer, rol- en klanttoegang, CSRF, audit, ontbrekende latere endpoints.");
