const fs = require('fs');
const glob = require('fs/promises');
const path = require('path');

const filesToUpdate = [
  'auth.ts',
  'app/api/users/[handle]/route.ts',
  'app/api/auth/verify-password/route.ts',
  'app/api/auth/login/route.ts',
  'app/api/auth/reset-password/route.ts',
  'app/api/auth/signup/route.ts',
  'app/api/auth/accept-invite/route.ts',
  'app/api/auth/resend-verification/route.ts',
  'app/api/auth/forgot-password/route.ts',
  'app/api/admin/invites/route.ts'
];

for (const file of filesToUpdate) {
  const fullPath = path.resolve(file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Replace import { comparePassword } from "@/app/lib/email";
    content = content.replace(/import\s+\{\s*comparePassword\s*\}\s+from\s+["']@\/app\/lib\/email["'];/g, 'import { comparePassword } from "@/app/lib/auth-crypto";');
    
    // Replace import { comparePassword, hashPassword } from "@/app/lib/email";
    content = content.replace(/import\s+\{\s*comparePassword,\s*hashPassword\s*\}\s+from\s+["']@\/app\/lib\/email["'];/g, 'import { comparePassword, hashPassword } from "@/app/lib/auth-crypto";');
    
    // Replace import { hashPassword } from "@/app/lib/email";
    content = content.replace(/import\s+\{\s*hashPassword\s*\}\s+from\s+["']@\/app\/lib\/email["'];/g, 'import { hashPassword } from "@/app/lib/auth-crypto";');
    
    // Replace import { hashPassword, generateToken, sendEmail } from "@/app/lib/email";
    content = content.replace(/import\s+\{\s*hashPassword,\s*generateToken,\s*sendEmail\s*\}\s+from\s+["']@\/app\/lib\/email["'];/g, 'import { hashPassword, generateToken } from "@/app/lib/auth-crypto";\nimport { sendEmail } from "@/app/lib/email";');
    
    // Replace import { generateToken, sendEmail } from "@/app/lib/email";
    content = content.replace(/import\s+\{\s*generateToken,\s*sendEmail\s*\}\s+from\s+["']@\/app\/lib\/email["'];/g, 'import { generateToken } from "@/app/lib/auth-crypto";\nimport { sendEmail } from "@/app/lib/email";');

    fs.writeFileSync(fullPath, content);
    console.log('Updated ' + file);
  } else {
    console.log('Not found: ' + file);
  }
}
