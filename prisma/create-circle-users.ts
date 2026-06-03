import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
const prisma = new PrismaClient({ adapter });

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const DEFAULT_PASSWORD = "Albiz@2026";

const circleUsers = [
  {
    name: "Sam Altman",
    handle: "samaltman",
    email: "samaltman@albiz.com",
    title: "CEO @ OpenAI",
    bio: "CEO of OpenAI. Building safe and beneficial artificial general intelligence for humanity.",
    location: "San Francisco, CA",
    country: "United States",
    city: "San Francisco",
    website: "openai.com",
    coverPhoto: "https://picsum.photos/seed/cover-samaltman/1200/400",
    avatar: "https://picsum.photos/seed/samaltman/200",
    followers: "2.1M",
    followingCount: "320",
    joinedDate: "May 2026",
    category: "Technology",
  },
  {
    name: "Jensen Huang",
    handle: "jensenhuang",
    email: "jensenhuang@albiz.com",
    title: "CEO & Co-founder @ NVIDIA",
    bio: "CEO and co-founder of NVIDIA. Accelerating AI, gaming, and scientific discovery with the world's most powerful GPUs.",
    location: "Santa Clara, CA",
    country: "United States",
    city: "Santa Clara",
    website: "nvidia.com",
    coverPhoto: "https://picsum.photos/seed/cover-jensen/1200/400",
    avatar: "https://picsum.photos/seed/jensenhuang/200",
    followers: "1.8M",
    followingCount: "140",
    joinedDate: "May 2026",
    category: "Technology",
  },
  {
    name: "Mukesh Ambani",
    handle: "mukeshambani",
    email: "mukeshambani@albiz.com",
    title: "Chairman & MD @ Reliance Industries",
    bio: "Chairman and Managing Director of Reliance Industries. Building India's digital and energy future.",
    location: "Mumbai, India",
    country: "India",
    city: "Mumbai",
    website: "ril.com",
    coverPhoto: "https://picsum.photos/seed/cover-mukesh/1200/400",
    avatar: "https://picsum.photos/seed/mukeshambani/200",
    followers: "3.4M",
    followingCount: "60",
    joinedDate: "May 2026",
    category: "Business",
  },
  {
    name: "Ratan Tata",
    handle: "ratantata",
    email: "ratantata@albiz.com",
    title: "Chairman Emeritus @ Tata Group",
    bio: "Former Chairman of Tata Sons. Philanthropist, mentor to Indian entrepreneurs, and icon of ethical business leadership.",
    location: "Mumbai, India",
    country: "India",
    city: "Mumbai",
    website: "tata.com",
    coverPhoto: "https://picsum.photos/seed/cover-ratantata/1200/400",
    avatar: "https://picsum.photos/seed/ratantata/200",
    followers: "5.2M",
    followingCount: "42",
    joinedDate: "May 2026",
    category: "Business",
  },
  {
    name: "Kunal Shah",
    handle: "kunalshah",
    email: "kunalshah@albiz.com",
    title: "Founder @ CRED",
    bio: "Founder of CRED. Thinker, entrepreneur, and angel investor. Building trust in financial ecosystems.",
    location: "Bangalore, India",
    country: "India",
    city: "Bangalore",
    website: "cred.club",
    coverPhoto: "https://picsum.photos/seed/cover-kunal/1200/400",
    avatar: "https://picsum.photos/seed/kunalshah/200",
    followers: "980k",
    followingCount: "510",
    joinedDate: "May 2026",
    category: "Startup",
  },
  {
    name: "Ritesh Agarwal",
    handle: "riteshagarwal",
    email: "riteshagarwal@albiz.com",
    title: "Founder & CEO @ OYO",
    bio: "Founder and CEO of OYO Hotels & Homes. One of the world's youngest billionaires. Thiel Fellow. Forbes 30 Under 30.",
    location: "Gurugram, India",
    country: "India",
    city: "Gurugram",
    website: "oyorooms.com",
    coverPhoto: "https://picsum.photos/seed/cover-ritesh/1200/400",
    avatar: "https://picsum.photos/seed/riteshagarwal/200",
    followers: "1.1M",
    followingCount: "380",
    joinedDate: "May 2026",
    category: "Startup",
  },
  {
    name: "Shah Rukh Khan",
    handle: "iamsrk",
    email: "srk@albiz.com",
    title: "Actor, Producer & Entrepreneur",
    bio: "Bollywood's King Khan. Actor. Producer at Red Chillies Entertainment. Co-owner of Kolkata Knight Riders. Building stories that move the world.",
    location: "Mumbai, India",
    country: "India",
    city: "Mumbai",
    website: "redchillies.com",
    coverPhoto: "https://picsum.photos/seed/cover-srk/1200/400",
    avatar: "https://picsum.photos/seed/iamsrk/200",
    followers: "8.6M",
    followingCount: "210",
    joinedDate: "May 2026",
    category: "Cinema",
  },
  {
    name: "SS Rajamouli",
    handle: "ssrajamouli",
    email: "rajamouli@albiz.com",
    title: "Film Director & Producer",
    bio: "Director of Baahubali and RRR. Telling Indian stories on the world stage. National Award winner.",
    location: "Hyderabad, India",
    country: "India",
    city: "Hyderabad",
    website: "saraswatifilms.com",
    coverPhoto: "https://picsum.photos/seed/cover-rajamouli/1200/400",
    avatar: "https://picsum.photos/seed/ssrajamouli/200",
    followers: "2.3M",
    followingCount: "95",
    joinedDate: "May 2026",
    category: "Cinema",
  },
  {
    name: "Virat Kohli",
    handle: "viratkohli",
    email: "virat@albiz.com",
    title: "Cricketer & Entrepreneur",
    bio: "Former Indian cricket captain. Founder of One8 brands. Chasing records on and off the field.",
    location: "Delhi, India",
    country: "India",
    city: "Delhi",
    website: "viratkohli.com",
    coverPhoto: "https://picsum.photos/seed/cover-virat/1200/400",
    avatar: "https://picsum.photos/seed/viratkohli/200",
    followers: "6.8M",
    followingCount: "175",
    joinedDate: "May 2026",
    category: "Sports",
  },
  {
    name: "Karan Johar",
    handle: "karanjohar",
    email: "karan@albiz.com",
    title: "Director, Producer & Host",
    bio: "Head of Dharma Productions. Director of Kuch Kuch Hota Hai, My Name is Khan, and more. Host of Koffee with Karan.",
    location: "Mumbai, India",
    country: "India",
    city: "Mumbai",
    website: "dharmaproductions.com",
    coverPhoto: "https://picsum.photos/seed/cover-karan/1200/400",
    avatar: "https://picsum.photos/seed/karanjohar/200",
    followers: "3.1M",
    followingCount: "290",
    joinedDate: "May 2026",
    category: "Entertainment",
  },
];

async function main() {
  console.log("Creating Circle Users...\n");
  const password = await hashPassword(DEFAULT_PASSWORD);

  for (const u of circleUsers) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ handle: u.handle }, { email: u.email }] },
    });

    if (existing) {
      console.log(`  ⚠  Skipped  ${u.name} — handle or email already exists`);
      continue;
    }

    await prisma.user.create({
      data: {
        name: u.name,
        handle: u.handle,
        email: u.email,
        password,
        emailVerified: new Date(),
        title: u.title,
        avatar: u.avatar,
        coverPhoto: u.coverPhoto,
        role: "CIRCLE",
        verified: true,
        isPremium: true,
        bio: u.bio,
        location: u.location,
        country: u.country,
        city: u.city,
        website: u.website,
        joinedDate: u.joinedDate,
        followers: u.followers,
        followingCount: u.followingCount,
      },
    });

    console.log(`  ✓  Created  ${u.name}  (@${u.handle})  [${u.category}]`);
  }

  console.log("\nDone. Default password for all accounts: Albiz@2026");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
