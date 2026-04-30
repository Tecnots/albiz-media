console.log('Testing resend-verification API...');
(async () => {
  try {
    const res = await fetch(`${process.env.APP_URL || 'http://localhost:3000'}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'devsummitsolutions@gmail.com' })
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response body:', text);
  } catch(e) {
    console.error('Error fetching:', e);
  }
})();
