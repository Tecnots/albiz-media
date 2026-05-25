const testLogin = async () => {
  try {
    const res = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "priyasharma@demo.albiz.com", password: "demo123" })
    });
    const data = await res.json();
    console.log("Login res:", res.status, data);

    if (res.ok) {
      const authRes = await fetch("http://localhost:3000/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "priyasharma@demo.albiz.com", password: "demo123" })
      });
      console.log("Auth res status:", authRes.status);
      const text = await authRes.text();
      console.log("Auth res:", text.substring(0, 100));
    }
  } catch (e) {
    console.error(e);
  }
};
testLogin();
