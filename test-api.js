async function check() {
  const res = await fetch("http://localhost:3000/api/admin/users");
  const users = await res.json();
  const editors = users.filter(u => u.role === "EDITOR");
  console.log("Editors found via API:", editors);
}
check();
