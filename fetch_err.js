fetch('http://192.168.1.60:3000/api/auth/session').then(r=>r.text()).then(t => {
  const m = t.match(/"description":"(.*?)"/);
  console.log("DESC:", m ? m[1] : "not found");
  const m2 = t.match(/"message":"(.*?)"/);
  console.log("MSG:", m2 ? m2[1] : "not found");
});
