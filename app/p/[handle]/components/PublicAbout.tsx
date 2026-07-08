import Image from "next/image";
import { Briefcase, GraduationCap, Zap, Heart } from "lucide-react";
import type { PublicUserData } from "../PublicProfile";

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-white rounded-xl p-5"
      style={{ border: "1px solid #e5e5e5" }}
    >
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <span className="text-sm font-semibold" style={{ color: "#0a0a0a" }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

export default function PublicAbout({ user }: { user: PublicUserData }) {
  const hasContent =
    user.bio ||
    user.experience.length > 0 ||
    user.education.length > 0 ||
    user.skills.length > 0 ||
    user.interests.length > 0;

  if (!hasContent) {
    return (
      <div
        className="bg-white rounded-xl py-16 text-center"
        style={{ border: "1px solid #e5e5e5" }}
      >
        <p className="text-sm" style={{ color: "#a3a3a3" }}>
          No information available
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {user.bio && (
        <div
          className="bg-white rounded-xl p-5"
          style={{ border: "1px solid #e5e5e5" }}
        >
          <p
            className="text-sm leading-relaxed"
            style={{ color: "#262626" }}
          >
            {user.bio}
          </p>
        </div>
      )}

      {user.experience.length > 0 && (
        <Section
          icon={<Briefcase className="w-4 h-4" style={{ color: "#737373" }} />}
          label="Experience"
        >
          <div className="space-y-0">
            {user.experience.map((exp, i) => (
              <div key={exp.id} className="flex gap-3 relative">
                {i < user.experience.length - 1 && (
                  <div
                    className="absolute top-11 w-px"
                    style={{
                      left: 19,
                      bottom: 0,
                      background: "#ebebeb",
                    }}
                  />
                )}
                <div
                  className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 z-10"
                  style={{ background: "#f5f5f5", border: "1px solid #ebebeb" }}
                >
                  {exp.logo ? (
                    <Image
                      src={exp.logo}
                      alt={exp.company}
                      width={40}
                      height={40}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-xs font-medium"
                      style={{ color: "#737373" }}
                    >
                      {exp.company.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-5">
                  <p className="text-sm font-medium" style={{ color: "#0a0a0a" }}>
                    {exp.role}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#737373" }}>
                    {exp.company} · {exp.period}
                  </p>
                  {exp.description && (
                    <p
                      className="text-xs mt-1.5 leading-relaxed"
                      style={{ color: "#525252" }}
                    >
                      {exp.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {user.education.length > 0 && (
        <Section
          icon={
            <GraduationCap className="w-4 h-4" style={{ color: "#737373" }} />
          }
          label="Education"
        >
          <div className="space-y-4">
            {user.education.map((edu) => (
              <div key={edu.id} className="flex gap-3">
                <div
                  className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
                  style={{ background: "#f5f5f5", border: "1px solid #ebebeb" }}
                >
                  {edu.logo ? (
                    <Image
                      src={edu.logo}
                      alt={edu.school}
                      width={40}
                      height={40}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-xs font-medium"
                      style={{ color: "#737373" }}
                    >
                      {edu.school.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "#0a0a0a" }}>
                    {edu.school}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#737373" }}>
                    {edu.degree}
                  </p>
                  <p className="text-xs" style={{ color: "#a3a3a3" }}>
                    {edu.period}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {user.skills.length > 0 && (
        <Section
          icon={<Zap className="w-4 h-4" style={{ color: "#737373" }} />}
          label="Skills"
        >
          <div className="flex flex-wrap gap-2">
            {user.skills.map((skill) => (
              <span
                key={skill}
                className="px-3 py-1.5 rounded-full text-xs"
                style={{
                  background: "#f5f5f5",
                  color: "#525252",
                  border: "1px solid #e5e5e5",
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        </Section>
      )}

      {user.interests.length > 0 && (
        <Section
          icon={<Heart className="w-4 h-4" style={{ color: "#737373" }} />}
          label="Interests"
        >
          <div className="flex flex-wrap gap-2">
            {user.interests.map((interest) => (
              <span
                key={interest}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(244,68,68,0.06)",
                  color: "#F44444",
                  border: "1px solid rgba(244,68,68,0.15)",
                }}
              >
                {interest}
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}