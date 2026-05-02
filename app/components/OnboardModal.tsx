"use client";

import { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, ArrowRight, X, Sparkles, Laptop, Briefcase, Bot, Rocket, TrendingUp, Palette, Megaphone, FlaskConical, Heart, Film, Trophy, Landmark, Brush, BarChart3, Globe, Zap, HeartPulse, Music, Radio } from "lucide-react";
import { AuthContext } from "@/app/lib/contexts";
import { api } from "@/app/lib/api";
import { VerifiedBadge } from "@/app/lib/shared-components";

const topicIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  tech: Laptop,
  business: Briefcase,
  ai: Bot,
  startups: Rocket,
  finance: TrendingUp,
  crypto: TrendingUp,
  science: FlaskConical,
  politics: Landmark,
  design: Brush,
  marketing: Megaphone,
  technology: Laptop,
  economy: BarChart3,
  world: Globe,
  health: HeartPulse,
  entertainment: Film,
  sports: Trophy,
  news: Radio,
  energy: Zap,
  ai_ml: Bot,
};

interface OnboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardModal({ isOpen, onClose }: OnboardModalProps) {
  const router = useRouter();
  const { currentUserId, isSignedIn } = useContext(AuthContext);
  const [step, setStep] = useState<"topics" | "people">("topics");
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [followedUsers, setFollowedUsers] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [availableTopics, setAvailableTopics] = useState<any[]>([]);
  const [suggestedPeople, setSuggestedPeople] = useState<any[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [topicFilter, setTopicFilter] = useState("");

  useEffect(() => {
    if (isOpen && currentUserId) {
      setStep("topics");
      setFollowedUsers(new Set());
      setTopicFilter("");
      
      // Fetch available topics
      setLoadingTopics(true);
      fetch("/api/topics")
        .then(res => res.json())
        .then(data => {
          setAvailableTopics(data);
          setLoadingTopics(false);
        })
        .catch(() => {
          setAvailableTopics([]);
          setLoadingTopics(false);
        });

      // Fetch suggested people and current following list
      setLoadingPeople(true);
      Promise.all([
        fetch(`/api/users/suggested?currentUserId=${currentUserId}`).then(res => res.json()),
        api.getFollowing(currentUserId)
      ])
        .then(([suggested, following]) => {
          setSuggestedPeople(suggested);
          // Pre-populate followedUsers with people they already follow among suggested
          const alreadyFollowing = new Set<number>();
          const followingSet = new Set(following);
          suggested.forEach((p: any) => {
            if (followingSet.has(p.id)) alreadyFollowing.add(p.id);
          });
          setFollowedUsers(alreadyFollowing);
          setLoadingPeople(false);
        })
        .catch(() => {
          setSuggestedPeople([]);
          setLoadingPeople(false);
        });

      // Fetch existing user interests
      fetch(`/api/interests?userId=${currentUserId}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            setSelectedTopics(new Set(data));
          } else {
            setSelectedTopics(new Set());
          }
        })
        .catch(() => setSelectedTopics(new Set()));
    }
  }, [isOpen, currentUserId, onClose]);

  const toggleTopic = (id: string) => {
    setSelectedTopics(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleFollow = (userId: number) => {
    setFollowedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleContinue = async () => {
    if (step === "topics") {
      setStep("people");
    } else {
      setSaving(true);
      try {
        if (currentUserId) {
          // Save interests
          await fetch("/api/interests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: currentUserId,
              interests: Array.from(selectedTopics),
            }),
          });

          // Sync follows
          const currentFollowing = await api.getFollowing(currentUserId);
          const currentSet = new Set(currentFollowing);
          
          // Follow new ones
          for (const userId of followedUsers) {
            if (!currentSet.has(userId)) {
              await api.follow(currentUserId, userId);
            }
          }
          
          // Unfollow ones that were unselected (only among suggested)
          for (const person of suggestedPeople) {
            if (currentSet.has(person.id) && !followedUsers.has(person.id)) {
              await api.unfollow(currentUserId, person.id);
            }
          }
        }

        // Dispatch event to refresh interests in other components
        window.dispatchEvent(new CustomEvent("albiz-interests-updated"));

        onClose();
      } catch (err) {
        console.error("Onboarding save failed:", err);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen || !isSignedIn) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleSkip}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#f5f5f5] transition-colors z-10"
        >
          <X className="w-5 h-5 text-[#737373]" />
        </button>

        <div className="p-6 overflow-y-auto max-h-[90vh]">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#F44444]/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-[#F44444]" />
            </div>
            <h1 className="text-2xl font-semibold text-[#0a0a0a] mb-2 tracking-tight">
              {step === "topics" ? "What are you interested in?" : "Follow people to get started"}
            </h1>
            <p className="text-[#737373] text-sm max-w-md mx-auto">
              {step === "topics"
                ? "Select topics you'd like to see in your feed"
                : "Follow interesting people to personalize your experience"}
            </p>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-2 rounded-full transition-all duration-300 ${step === "topics" ? "bg-[#F44444] w-10" : "bg-[#F44444]"}`} />
              <div className={`w-8 h-2 rounded-full transition-all duration-300 ${step === "people" ? "bg-[#F44444] w-10" : "bg-[#e5e5e5]"}`} />
            </div>
          </div>

          {/* Content */}
          {step === "topics" ? (
            <>
              {/* Search/Filter input */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search topics..."
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#e5e5e5] text-sm focus:outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444] transition-all"
                />
              </div>
              
              {loadingTopics ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-[#F44444] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {availableTopics
                    .filter(topic => 
                      topic.label.toLowerCase().includes(topicFilter.toLowerCase()) ||
                      topic.id.toLowerCase().includes(topicFilter.toLowerCase())
                    )
                    .map((topic) => {
                      const isSelected = selectedTopics.has(topic.id);
                      const IconComponent = topicIcons[topic.id];
                      return (
                        <button
                          key={topic.id}
                          onClick={() => toggleTopic(topic.id)}
                          className={`group p-3 rounded-xl border-2 transition-all duration-200 text-left ${
                            isSelected
                              ? "border-[#F44444] bg-[#F44444]/5"
                              : "border-[#f0f0f0] hover:border-[#d5d5d5] hover:bg-[#fafafa]"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            {IconComponent && <IconComponent className="w-6 h-6 text-[#0a0a0a]" />}
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-[#F44444] flex items-center justify-center shadow-sm">
                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <p className={`text-xs font-semibold leading-tight ${isSelected ? "text-[#F44444]" : "text-[#0a0a0a] group-hover:text-[#525252]"}`}>
                            {topic.label}
                          </p>
                        </button>
                      );
                    })}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
              {loadingPeople ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-[#F44444] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : suggestedPeople.length === 0 ? (
                <div className="text-center py-8 text-[#737373] text-sm">
                  No suggested users available
                </div>
              ) : (
                suggestedPeople.map((person) => {
                const isFollowing = followedUsers.has(person.id);
                return (
                  <div
                    key={person.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-[#f0f0f0] hover:border-[#e5e5e5] hover:shadow-sm transition-all duration-200 bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-[#f5f5f5] ring-2 ring-[#f0f0f0]">
                        <Image
                          src={person.avatar}
                          alt={person.name}
                          width={48}
                          height={48}
                          className="object-cover w-full h-full"
                          unoptimized
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-[#0a0a0a] text-sm">{person.name}</span>
                          {person.verified && <VerifiedBadge />}
                        </div>
                        <p className="text-xs text-[#737373] font-medium">{person.title}</p>
                        <p className="text-[10px] text-[#a3a3a3]">@{person.handle}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFollow(person.id)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
                        isFollowing
                          ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#e5e5e5]"
                          : "bg-[#F44444] text-white hover:bg-[#d64d3c] hover:shadow-md"
                      }`}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                  </div>
                );
              })
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-4 border-t border-[#f0f0f0]">
            <button
              onClick={handleContinue}
              disabled={saving || (step === "topics" && selectedTopics.size === 0)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#F44444] text-white rounded-xl text-sm font-semibold hover:bg-[#d64d3c] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : step === "topics" ? "Continue" : "Get Started"}
              {!saving && step === "topics" && <ArrowRight className="w-4 h-4" />}
            </button>
            <button
              onClick={handleSkip}
              className="w-full py-2.5 text-sm font-medium text-[#737373] hover:text-[#0a0a0a] transition-colors rounded-xl hover:bg-[#fafafa]"
            >
              Skip for now
            </button>
          </div>

          {step === "topics" && selectedTopics.size > 0 && (
            <p className="text-center text-sm text-[#F44444] font-medium mt-2">
              {selectedTopics.size} topic{selectedTopics.size !== 1 ? "s" : ""} selected
            </p>
          )}

          {step === "people" && followedUsers.size > 0 && (
            <p className="text-center text-sm text-[#F44444] font-medium mt-2">
              {followedUsers.size} person{followedUsers.size !== 1 ? "s" : ""} to follow
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
