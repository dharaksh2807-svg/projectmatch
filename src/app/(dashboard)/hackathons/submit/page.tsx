"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  Sparkles,
  MapPin,
  Globe,
  Laptop,
  Trophy,
  Tag,
  AlertCircle,
  Loader2,
  ExternalLink,
  Image as ImageIcon,
  Plus,
  ShieldCheck,
  GraduationCap,
  Mail,
  Check,
  Eye,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { HackathonCard } from "@/components/hackathons/hackathon-card";
import { cn } from "@/lib/utils";
import type { Hackathon, EligibilityScope } from "@/types";
import type { ParticipationMode } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// PRESETS & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

interface CollegeQuickPick {
  name: string;
  slug: string;
  campus: string;
  venue: string;
  city: string;
  state: string;
  short: string;
}

const COLLEGE_QUICK_PICKS: CollegeQuickPick[] = [
  {
    name: "SRM Institute of Science and Technology",
    slug: "srm-ist",
    campus: "Kattankulathur Campus",
    venue: "Tech Park / TP-401",
    city: "Chennai",
    state: "Tamil Nadu",
    short: "SRMIST",
  },
  {
    name: "IIT Madras",
    slug: "iit-madras",
    campus: "Main Campus",
    venue: "IC&SR Auditorium",
    city: "Chennai",
    state: "Tamil Nadu",
    short: "IIT Madras",
  },
  {
    name: "Anna University",
    slug: "anna-univ",
    campus: "CEG Campus",
    venue: "Vivekananda Auditorium",
    city: "Chennai",
    state: "Tamil Nadu",
    short: "Anna University",
  },
  {
    name: "VIT Chennai",
    slug: "vit-chennai",
    campus: "Vandalur-Kelambakkam Campus",
    venue: "Auditorium Block",
    city: "Chennai",
    state: "Tamil Nadu",
    short: "VIT Chennai",
  },
  {
    name: "SSN College of Engineering",
    slug: "ssn",
    campus: "Kalavakkam Campus",
    venue: "Main Seminar Hall",
    city: "Chennai",
    state: "Tamil Nadu",
    short: "SSN College",
  },
];

const PRESET_BANNERS = [
  {
    id: "neon-cyber",
    title: "Cyber Neon Wave",
    tag: "AI & Future",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "terminal-matrix",
    title: "Terminal Stream",
    tag: "Dev & Code",
    url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "tech-mesh",
    title: "Vibrant Mesh",
    tag: "Design & Web3",
    url: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "hackathon-squad",
    title: "Collaborative Builders",
    tag: "Campus Squad",
    url: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "circuit-silicon",
    title: "Silicon Core",
    tag: "Hardware & IoT",
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
  },
];

const SUGGESTED_TECH_TAGS = [
  "AI/ML",
  "Generative AI",
  "Web3",
  "Cloud & DevOps",
  "Mobile App Dev",
  "Cybersecurity",
  "IoT & Robotics",
  "Open Source",
  "FinTech",
  "HealthTech",
  "EdTech",
  "AR/VR",
];

// Helper: formats a date into "YYYY-MM-DDTHH:mm" for datetime-local input
function formatForInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export default function SubmitHackathonPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  // Initial future dates
  const initialDates = useMemo(() => {
    const now = new Date();
    // 2 weeks from now
    const regDeadline = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    regDeadline.setHours(23, 59, 0, 0);

    // 3 weeks from now
    const start = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
    start.setHours(9, 0, 0, 0);

    // 3 weeks + 2 days
    const end = new Date(start.getTime() + 48 * 60 * 60 * 1000);
    end.setHours(18, 0, 0, 0);

    return {
      regDeadline: formatForInput(regDeadline),
      start: formatForInput(start),
      end: formatForInput(end),
    };
  }, []);

  // Form State
  const [name, setName] = useState("HackMatrix 2026 — Inter-College AI Blitz");
  const [description, setDescription] = useState(
    "A 36-hour high-octane collegiate hackathon bringing student innovators together to build real-world AI, Web3, and cloud solutions. Features mentorship from industry engineers, ₹50,000 in prizes, and direct networking with tech sponsors."
  );
  const [organizerClubName, setOrganizerClubName] = useState("GDSC SRMIST");
  const [organizerContact, setOrganizerContact] = useState("gdsc@srmist.edu.in");
  const [bannerUrl, setBannerUrl] = useState(PRESET_BANNERS[0].url);

  // College & Location State
  const [selectedQuickPick, setSelectedQuickPick] = useState<string>("srm-ist");
  const [isCustomCollege, setIsCustomCollege] = useState(false);
  const [collegeName, setCollegeName] = useState("SRM Institute of Science and Technology");
  const [collegeSlug, setCollegeSlug] = useState("srm-ist");
  const [campusName, setCampusName] = useState("Kattankulathur Campus");
  const [venueAddress, setVenueAddress] = useState("Tech Park Hall 401");
  const [city, setCity] = useState("Chennai");
  const [state, setState] = useState("Tamil Nadu");

  // Participation Mode & Eligibility
  const [participationMode, setParticipationMode] = useState<ParticipationMode>("OFFLINE");
  const [eligibilityScope, setEligibilityScope] = useState<EligibilityScope>("ANY_COLLEGE_STUDENT");

  // Dates & Registration Links
  const [registrationDeadline, setRegistrationDeadline] = useState(initialDates.regDeadline);
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [registrationUrl, setRegistrationUrl] = useState("https://unstop.com/hackathons/srm-hackmatrix");
  const [websiteUrl, setWebsiteUrl] = useState("https://srmist.edu.in/hackmatrix");
  const [prizeAmount, setPrizeAmount] = useState<number | "">(50000);
  const [prizeCurrency] = useState("INR");
  const [registrationFee, setRegistrationFee] = useState<number | "">(0);
  const [tags, setTags] = useState<string[]>(["AI/ML", "Web3", "Cloud & DevOps"]);
  const [customTagInput, setCustomTagInput] = useState("");

  // UI status state
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form"); // mobile toggle

  // Quick pick selection handler
  const handleSelectQuickPick = (pick: CollegeQuickPick) => {
    setSelectedQuickPick(pick.slug);
    setIsCustomCollege(false);
    setCollegeName(pick.name);
    setCollegeSlug(pick.slug);
    setCampusName(pick.campus);
    setVenueAddress(pick.venue);
    setCity(pick.city);
    setState(pick.state);
  };

  const handleSelectOtherCollege = () => {
    setSelectedQuickPick("other");
    setIsCustomCollege(true);
    setCollegeName("");
    setCollegeSlug("");
    setCampusName("");
    setVenueAddress("");
  };

  // Custom college name change with automatic slugification
  const handleCustomCollegeNameChange = (val: string) => {
    setCollegeName(val);
    const derivedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setCollegeSlug(derivedSlug);
  };

  // Tag toggle helper
  const handleToggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter((t) => t !== tag));
    } else {
      if (tags.length >= 10) {
        toast("Maximum 10 tags allowed", "info");
        return;
      }
      setTags([...tags, tag]);
    }
  };

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      setCustomTagInput("");
      return;
    }
    if (tags.length >= 10) {
      toast("Maximum 10 tags allowed", "info");
      return;
    }
    setTags([...tags, trimmed]);
    setCustomTagInput("");
  };

  // Date validity check
  const dateWarnings = useMemo(() => {
    if (!startDate || !endDate || !registrationDeadline) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const deadline = new Date(registrationDeadline);
    const now = new Date();

    if (deadline <= now) return "Registration deadline must be in the future.";
    if (start <= now) return "Event start date must be in the future.";
    if (end <= start) return "Event end date must be after the start date.";
    if (deadline > start) return "Registration deadline must be on or before start date.";
    return null;
  }, [startDate, endDate, registrationDeadline]);

  // Construct real-time HackathonCard preview object
  const previewHackathon: Hackathon = useMemo(() => {
    return {
      id: "preview-card-temp",
      name: name.trim() || "Untitled Hackathon",
      description:
        description.trim() ||
        "Provide a compelling description of your event, track challenges, eligibility, and prize pool...",
      stream: "COMMUNITY_LOCAL",
      isCommunitySubmitted: true,
      isNational: false,
      verificationStatus: "VERIFIED",
      status: "UPCOMING",
      registrationStatus: "OPEN",
      computedRegistrationStatus: "OPEN",
      participationMode,
      eligibilityScope,
      collegeName: collegeName.trim() || "Campus Host College",
      collegeSlug: collegeSlug.trim() || "campus",
      campusName: campusName.trim() || null,
      venueAddress: venueAddress.trim() || null,
      city: city.trim() || "Chennai",
      state: state.trim() || "Tamil Nadu",
      country: "India",
      countryCode: "IN",
      startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : new Date().toISOString(),
      registrationDeadline: registrationDeadline
        ? new Date(registrationDeadline).toISOString()
        : new Date().toISOString(),
      registrationUrl: registrationUrl.trim() || "https://unstop.com",
      websiteUrl: websiteUrl.trim() || null,
      bannerUrl: bannerUrl.trim() || null,
      organizerClubName: organizerClubName.trim() || "Campus Club / Chapter",
      organizerName: organizerClubName.trim() || "Campus Club / Chapter",
      organizerContact: organizerContact.trim() || "coordinator@college.edu",
      devpostUrl: null,
      location: venueAddress ? `${venueAddress}, ${city}` : `${collegeName}, ${city}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prizeAmount: typeof prizeAmount === "number" && prizeAmount > 0 ? prizeAmount : null,
      prizeCurrency,
      registrationFee: typeof registrationFee === "number" ? registrationFee : 0,
      tags: tags.length > 0 ? tags : ["AI/ML", "Web3"],
      _count: {
        projects: 3,
      },
      projects: [
        {
          id: "preview-p1",
          title: "Autonomous Campus Delivery Bot",
          projectType: "Hackathon",
          owner: {
            name: "Alex Kumar",
            image: null,
          },
          roles: [
            {
              id: "r1",
              title: "Computer Vision Lead",
              requiredSkills: ["PyTorch", "ROS"],
            },
          ],
        },
      ],
    };
  }, [
    name,
    description,
    participationMode,
    eligibilityScope,
    collegeName,
    collegeSlug,
    campusName,
    venueAddress,
    city,
    state,
    startDate,
    endDate,
    registrationDeadline,
    registrationUrl,
    websiteUrl,
    bannerUrl,
    organizerClubName,
    organizerContact,
    prizeAmount,
    prizeCurrency,
    registrationFee,
    tags,
  ]);

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});

    // Client-side validation checks
    const errors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 3) {
      errors.name = "Event name must be at least 3 characters.";
    }
    if (!description.trim() || description.trim().length < 20) {
      errors.description = "Description must be at least 20 characters.";
    }
    if (!collegeName.trim() || collegeName.trim().length < 2) {
      errors.collegeName = "College name is required.";
    }
    if (!organizerClubName.trim() || organizerClubName.trim().length < 2) {
      errors.organizerClubName = "Organizing club or chapter name is required.";
    }
    if (!organizerContact.trim() || organizerContact.trim().length < 3) {
      errors.organizerContact = "Coordinator contact (email/Discord) is required.";
    }
    if (!registrationUrl.trim() || !registrationUrl.startsWith("http")) {
      errors.registrationUrl = "Valid registration URL (http/https) is required.";
    }
    if (websiteUrl.trim() && !websiteUrl.startsWith("http")) {
      errors.websiteUrl = "Website URL must begin with http:// or https://";
    }
    if (bannerUrl.trim() && !bannerUrl.startsWith("http")) {
      errors.bannerUrl = "Banner URL must begin with http:// or https://";
    }

    if (dateWarnings) {
      errors.dates = dateWarnings;
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast("Please fix the highlighted form errors.", "error");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        collegeName: collegeName.trim(),
        collegeSlug: collegeSlug.trim() || undefined,
        campusName: campusName.trim() || null,
        venueAddress: venueAddress.trim() || null,
        city: city.trim() || "Chennai",
        state: state.trim() || "Tamil Nadu",
        participationMode,
        eligibilityScope,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        registrationDeadline: new Date(registrationDeadline).toISOString(),
        registrationUrl: registrationUrl.trim(),
        websiteUrl: websiteUrl.trim() || null,
        bannerUrl: bannerUrl.trim() || null,
        organizerClubName: organizerClubName.trim(),
        organizerContact: organizerContact.trim(),
        prizeAmount: typeof prizeAmount === "number" && prizeAmount > 0 ? prizeAmount : null,
        prizeCurrency,
        registrationFee: typeof registrationFee === "number" ? registrationFee : 0,
        tags,
      };

      const res = await fetch("/api/hackathons/organizer/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          toast("You must be logged in to submit a hackathon.", "error");
          router.push("/auth/signin?callbackUrl=/hackathons/submit");
          return;
        }

        if (data.details) {
          const fieldErrors: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.details)) {
            fieldErrors[k] = Array.isArray(v) ? (v as string[])[0] : String(v);
          }
          setValidationErrors(fieldErrors);
          toast(data.message || "Validation failed. Check field errors.", "error");
        } else {
          toast(data.message || "Failed to submit hackathon.", "error");
        }
        return;
      }

      // Success!
      toast("Hackathon submitted successfully! Listed on campus discover.", "success");
      const targetCollege = collegeSlug.trim() || "srm-ist";

      startTransition(() => {
        router.push(`/hackathons?college=${encodeURIComponent(targetCollege)}`);
      });
    } catch (err: unknown) {
      console.error("Submission error:", err);
      toast("A network error occurred. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top sticky banner / breadcrumb */}
      <div className="border-b border-border/40 bg-card/40 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <Link
            href="/hackathons"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Hackathons</span>
          </Link>

          {/* Mobile Tab Switcher */}
          <div className="flex lg:hidden items-center p-1 bg-muted/60 rounded-lg border border-border/50 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("form")}
              className={cn(
                "px-3 py-1 rounded-md font-medium transition-all",
                activeTab === "form" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              Form
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={cn(
                "px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5",
                activeTab === "preview" ? "bg-background text-emerald-400 shadow-sm" : "text-muted-foreground"
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              Live Preview
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[11px] px-2.5 py-0.5 gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Community & Campus Stream
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        {/* ─────────────────────────────────────────────────────────────
            HEADER SECTION
            ───────────────────────────────────────────────────────────── */}
        <div className="mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            Organizer Portal
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
            Submit a Campus or Local Hackathon
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
            Reach thousands of passionate student hackers across your campus and city. Your submission is instantly
            published and searchable with college, eligibility, and mode filters.
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            MAIN SPLIT LAYOUT (60% Form on Left, 40% Live Preview on Right)
            ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ═══════════════════════════════════════════════════════════
              LEFT COLUMN: THE FORM (col-span-7)
              ═══════════════════════════════════════════════════════════ */}
          <form
            onSubmit={handleSubmit}
            className={cn(
              "space-y-8 lg:col-span-7",
              activeTab === "preview" ? "hidden lg:block" : "block"
            )}
          >
            {/* ─────────────────────────────────────────────────────────
                SECTION 1: BASIC EVENT IDENTITY
                ───────────────────────────────────────────────────────── */}
            <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-4 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg font-bold">Basic Event Identity</CardTitle>
                    <CardDescription className="text-xs">
                      Define the name, story, and organizing team behind this hackathon.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-5">
                {/* Event Title */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="event-name" className="text-xs font-semibold">
                      Event Title <span className="text-rose-400">*</span>
                    </Label>
                    <span className="text-[11px] text-muted-foreground">{name.length}/120</span>
                  </div>
                  <Input
                    id="event-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. SRM HackMatrix 2026, CodeForge Anna Univ"
                    maxLength={120}
                    className={cn(
                      validationErrors.name && "border-rose-500/80 focus-visible:ring-rose-500/40"
                    )}
                  />
                  {validationErrors.name && (
                    <p className="text-xs text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {validationErrors.name}
                    </p>
                  )}
                </div>

                {/* Short Description */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="event-desc" className="text-xs font-semibold">
                      Short Description & Tracks <span className="text-rose-400">*</span>
                    </Label>
                    <span className="text-[11px] text-muted-foreground">{description.length}/5000</span>
                  </div>
                  <Textarea
                    id="event-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Describe challenge tracks, what hackers will build, workshops, prizes, and criteria..."
                    className={cn(
                      "text-xs sm:text-sm leading-relaxed",
                      validationErrors.description && "border-rose-500/80 focus-visible:ring-rose-500/40"
                    )}
                  />
                  {validationErrors.description && (
                    <p className="text-xs text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {validationErrors.description}
                    </p>
                  )}
                </div>

                {/* Organizing Club & Contact Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="club-name" className="text-xs font-semibold">
                      Organizing Club / Student Chapter <span className="text-rose-400">*</span>
                    </Label>
                    <div className="relative">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="club-name"
                        value={organizerClubName}
                        onChange={(e) => setOrganizerClubName(e.target.value)}
                        placeholder="e.g. GDSC SRMIST, ACM Student Chapter"
                        className={cn(
                          "pl-9",
                          validationErrors.organizerClubName && "border-rose-500/80"
                        )}
                      />
                    </div>
                    {validationErrors.organizerClubName && (
                      <p className="text-xs text-rose-400">{validationErrors.organizerClubName}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="coord-contact" className="text-xs font-semibold">
                      Coordinator Contact (Email or Discord) <span className="text-rose-400">*</span>
                    </Label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="coord-contact"
                        value={organizerContact}
                        onChange={(e) => setOrganizerContact(e.target.value)}
                        placeholder="e.g. contact@gdscsrm.org or Discord tag"
                        className={cn(
                          "pl-9",
                          validationErrors.organizerContact && "border-rose-500/80"
                        )}
                      />
                    </div>
                    {validationErrors.organizerContact && (
                      <p className="text-xs text-rose-400">{validationErrors.organizerContact}</p>
                    )}
                  </div>
                </div>

                {/* Banner Image URL & Presets */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="banner-url" className="text-xs font-semibold flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      Banner Image URL
                    </Label>
                    {bannerUrl && (
                      <button
                        type="button"
                        onClick={() => setBannerUrl("")}
                        className="text-[11px] text-muted-foreground hover:text-rose-400 transition-colors"
                      >
                        Clear image
                      </button>
                    )}
                  </div>
                  <Input
                    id="banner-url"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className={cn(validationErrors.bannerUrl && "border-rose-500/80")}
                  />

                  {/* Preset Banner Quick-Picks */}
                  <div className="space-y-2 pt-1">
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Or pick from curated high-res tech banners:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {PRESET_BANNERS.map((preset) => {
                        const isSelected = bannerUrl === preset.url;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setBannerUrl(preset.url)}
                            className={cn(
                              "relative group rounded-lg overflow-hidden border text-left transition-all aspect-video",
                              isSelected
                                ? "ring-2 ring-emerald-400 border-emerald-400 shadow-sm"
                                : "border-border/60 hover:border-emerald-400/60 opacity-80 hover:opacity-100"
                            )}
                          >
                            <img
                              src={preset.url}
                              alt={preset.title}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-1.5 flex flex-col justify-end">
                              <span className="text-[10px] font-bold text-white truncate leading-tight">
                                {preset.title}
                              </span>
                            </div>
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ─────────────────────────────────────────────────────────
                SECTION 2: COLLEGE & LOCATION DETAILS
                ───────────────────────────────────────────────────────── */}
            <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-4 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg font-bold">College & Location Details</CardTitle>
                    <CardDescription className="text-xs">
                      Connect your hackathon to a specific university campus or institutional venue.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-5">
                {/* Quick Pick Buttons */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    College / University Quick Picks <span className="text-rose-400">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {COLLEGE_QUICK_PICKS.map((pick) => {
                      const isSelected = selectedQuickPick === pick.slug && !isCustomCollege;
                      return (
                        <button
                          key={pick.slug}
                          type="button"
                          onClick={() => handleSelectQuickPick(pick)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5",
                            isSelected
                              ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/60 shadow-sm ring-1 ring-indigo-500/40"
                              : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                          <span>{pick.short}</span>
                          {isSelected && <Check className="w-3 h-3 text-indigo-400" />}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={handleSelectOtherCollege}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5",
                        isCustomCollege
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/60 shadow-sm ring-1 ring-indigo-500/40"
                          : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Other (Custom College)</span>
                    </button>
                  </div>
                </div>

                {/* College Name & Slug fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="college-name" className="text-xs font-semibold">
                      Full College Name <span className="text-rose-400">*</span>
                    </Label>
                    <Input
                      id="college-name"
                      value={collegeName}
                      onChange={(e) =>
                        isCustomCollege
                          ? handleCustomCollegeNameChange(e.target.value)
                          : setCollegeName(e.target.value)
                      }
                      placeholder="e.g. SRM Institute of Science and Technology"
                      className={cn(validationErrors.collegeName && "border-rose-500/80")}
                    />
                    {validationErrors.collegeName && (
                      <p className="text-xs text-rose-400">{validationErrors.collegeName}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="college-slug" className="text-xs font-semibold">
                      Filter Slug
                    </Label>
                    <Input
                      id="college-slug"
                      value={collegeSlug}
                      onChange={(e) => setCollegeSlug(e.target.value)}
                      placeholder="e.g. srm-ist"
                      className="font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">Used for URL filter</p>
                  </div>
                </div>

                {/* Campus Name & Venue */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="campus-name" className="text-xs font-semibold">
                      Campus Name / Branch
                    </Label>
                    <Input
                      id="campus-name"
                      value={campusName}
                      onChange={(e) => setCampusName(e.target.value)}
                      placeholder="e.g. Kattankulathur Campus, CEG Campus"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="venue-address" className="text-xs font-semibold">
                      Venue / Hall / Auditorium
                    </Label>
                    <Input
                      id="venue-address"
                      value={venueAddress}
                      onChange={(e) => setVenueAddress(e.target.value)}
                      placeholder="e.g. Tech Park Hall 401, Mini Audi 2"
                    />
                  </div>
                </div>

                {/* City & State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="city" className="text-xs font-semibold">
                      City <span className="text-rose-400">*</span>
                    </Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Chennai"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="state" className="text-xs font-semibold">
                      State <span className="text-rose-400">*</span>
                    </Label>
                    <Input
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. Tamil Nadu"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ─────────────────────────────────────────────────────────
                SECTION 3: PARTICIPATION MODE & ELIGIBILITY
                ───────────────────────────────────────────────────────── */}
            <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-4 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg font-bold">
                      Participation Mode & Eligibility
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Set how participants join and who is allowed to register.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-6">
                {/* Participation Mode Cards */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Participation Mode <span className="text-rose-400">*</span>
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        mode: "OFFLINE" as ParticipationMode,
                        title: "In-Person",
                        subtitle: "Offline on-campus hackathon",
                        icon: MapPin,
                        color: "text-amber-500 dark:text-amber-400",
                        selectedBg: "border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30",
                      },
                      {
                        mode: "ONLINE" as ParticipationMode,
                        title: "Online",
                        subtitle: "Virtual remote participation",
                        icon: Globe,
                        color: "text-blue-400",
                        selectedBg: "border-blue-500/60 bg-blue-500/10 ring-1 ring-blue-500/30",
                      },
                      {
                        mode: "HYBRID" as ParticipationMode,
                        title: "Hybrid",
                        subtitle: "On-campus + remote allowed",
                        icon: Laptop,
                        color: "text-teal-400",
                        selectedBg: "border-teal-500/60 bg-teal-500/10 ring-1 ring-teal-500/30",
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = participationMode === item.mode;
                      return (
                        <button
                          key={item.mode}
                          type="button"
                          onClick={() => setParticipationMode(item.mode)}
                          className={cn(
                            "p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 relative",
                            isSelected
                              ? item.selectedBg
                              : "border-border/60 bg-card/40 hover:bg-muted/40 hover:border-border"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className={cn("p-2 rounded-lg bg-muted/60", item.color)}>
                              <Icon className="w-4 h-4" />
                            </div>
                            {isSelected && (
                              <div className="w-4 h-4 rounded-full bg-emerald-500 text-black flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-xs sm:text-sm text-foreground">{item.title}</div>
                            <div className="text-[11px] text-muted-foreground leading-snug">
                              {item.subtitle}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Eligibility Radio Cards */}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-semibold">
                    Eligibility Scope <span className="text-rose-400">*</span>
                  </Label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      {
                        scope: "OPEN_TO_ALL" as EligibilityScope,
                        emoji: "🟢",
                        title: "Open to All",
                        subtitle: "Anyone can participate (students, pros, builders from any background)",
                        border: "border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/40",
                      },
                      {
                        scope: "ANY_COLLEGE_STUDENT" as EligibilityScope,
                        emoji: "🟡",
                        title: "Any College Student",
                        subtitle: "Inter-college event. Any student with a valid college ID from any university.",
                        border: "border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/40",
                      },
                      {
                        scope: "HOST_COLLEGE_ONLY" as EligibilityScope,
                        emoji: "🔴",
                        title: `Host College Only (${collegeName ? collegeName.split(" ")[0] : "Intra-Campus"})`,
                        subtitle: "Intra-college only. Restricted strictly to students enrolled in the host college.",
                        border: "border-rose-500/60 bg-rose-500/10 ring-1 ring-rose-500/40",
                      },
                    ].map((card) => {
                      const isSelected = eligibilityScope === card.scope;
                      return (
                        <div
                          key={card.scope}
                          onClick={() => setEligibilityScope(card.scope)}
                          className={cn(
                            "p-3.5 sm:p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3",
                            isSelected
                              ? card.border
                              : "border-border/60 bg-card/40 hover:bg-muted/40 hover:border-border"
                          )}
                        >
                          <span className="text-lg leading-none mt-0.5">{card.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs sm:text-sm text-foreground">
                                {card.title}
                              </span>
                              {isSelected && (
                                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                                  Selected
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                              {card.subtitle}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ─────────────────────────────────────────────────────────
                SECTION 4: DATES & REGISTRATION LINK
                ───────────────────────────────────────────────────────── */}
            <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-4 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold text-sm">
                    4
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg font-bold">
                      Dates, Links, Prizes & Tags
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Set timeline checkpoints, official registration link, and prize details.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-5">
                {/* Dates Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-deadline" className="text-xs font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Registration Deadline <span className="text-rose-400">*</span>
                    </Label>
                    <Input
                      id="reg-deadline"
                      type="datetime-local"
                      value={registrationDeadline}
                      onChange={(e) => setRegistrationDeadline(e.target.value)}
                      className="text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                      Auto-removal: Automatically hidden from student discovery once closed; purged after 7 days.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="start-date" className="text-xs font-semibold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      Hackathon Start Date <span className="text-rose-400">*</span>
                    </Label>
                    <Input
                      id="start-date"
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="end-date" className="text-xs font-semibold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      Hackathon End Date <span className="text-rose-400">*</span>
                    </Label>
                    <Input
                      id="end-date"
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                {dateWarnings && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>{dateWarnings}</span>
                  </div>
                )}

                {/* Registration & Website URLs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-url" className="text-xs font-semibold flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                      Official Registration Link <span className="text-rose-400">*</span>
                    </Label>
                    <Input
                      id="reg-url"
                      value={registrationUrl}
                      onChange={(e) => setRegistrationUrl(e.target.value)}
                      placeholder="e.g. https://unstop.com/..., Google Forms, Devfolio"
                      className={cn(validationErrors.registrationUrl && "border-rose-500/80")}
                    />
                    <p className="text-[10px] text-muted-foreground">Unstop, Google Forms, Devfolio, or portal</p>
                    {validationErrors.registrationUrl && (
                      <p className="text-xs text-rose-400">{validationErrors.registrationUrl}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="web-url" className="text-xs font-semibold flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      Event Website (Optional)
                    </Label>
                    <Input
                      id="web-url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="e.g. https://srmist.edu.in/hackmatrix"
                    />
                    <p className="text-[10px] text-muted-foreground">Club page, guidelines or rules doc</p>
                  </div>
                </div>

                {/* Prize Pool & Entry Fee */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="prize-amount" className="text-xs font-semibold flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      Total Prize Pool (₹ INR)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        ₹
                      </span>
                      <Input
                        id="prize-amount"
                        type="number"
                        min="0"
                        step="1000"
                        value={prizeAmount}
                        onChange={(e) =>
                          setPrizeAmount(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        placeholder="50000"
                        className="pl-8 text-xs sm:text-sm font-semibold"
                      />
                    </div>
                    {/* Quick Prize chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[10000, 25000, 50000, 100000, 200000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setPrizeAmount(amt)}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded border transition-colors",
                            prizeAmount === amt
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-muted/40 text-muted-foreground border-border/40 hover:text-foreground"
                          )}
                        >
                          ₹{(amt / 1000).toFixed(0)}k
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="entry-fee" className="text-xs font-semibold">
                        Entry Fee (₹ INR)
                      </Label>
                      <button
                        type="button"
                        onClick={() => setRegistrationFee(0)}
                        className={cn(
                          "text-[11px] font-medium transition-colors",
                          registrationFee === 0 ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Set Free (₹0)
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        ₹
                      </span>
                      <Input
                        id="entry-fee"
                        type="number"
                        min="0"
                        value={registrationFee}
                        onChange={(e) =>
                          setRegistrationFee(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        placeholder="0"
                        className="pl-8 text-xs sm:text-sm"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {registrationFee === 0 || registrationFee === ""
                        ? "🟢 Free Entry for all participants"
                        : `₹${registrationFee} per team / hacker`}
                    </p>
                  </div>
                </div>

                {/* Tech Tags */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                      Tech Tags & Domains ({tags.length}/10)
                    </Label>
                    <span className="text-[10px] text-muted-foreground">Click to toggle</span>
                  </div>

                  {/* Preset Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_TECH_TAGS.map((tag) => {
                      const isSelected = tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleToggleTag(tag)}
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-full border transition-all flex items-center gap-1",
                            isSelected
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                              : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom tag input */}
                  <div className="flex items-center gap-2 pt-2 max-w-sm">
                    <Input
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomTag();
                        }
                      }}
                      placeholder="Add custom tag (e.g. Rust, LLMs)..."
                      className="text-xs h-8"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddCustomTag}
                      className="text-xs h-8 px-3 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error summary if any */}
            {Object.keys(validationErrors).length > 0 && (
              <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-200 text-xs space-y-1.5 animate-shake">
                <div className="flex items-center gap-2 font-bold text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Please resolve the following before publishing:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 pl-1 text-rose-200/90 text-[11px]">
                  {Object.values(validationErrors).map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Submit Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                By publishing, your hackathon becomes immediately visible to students and eligible for team recruitment.
              </p>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm px-8 py-2.5 shadow-lg shadow-emerald-950/40 gap-2 shrink-0 transition-all hover:scale-[1.01]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Publishing to Campus Hub...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    <span>Publish Hackathon</span>
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* ═══════════════════════════════════════════════════════════
              RIGHT COLUMN: STICKY LIVE CARD PREVIEW (col-span-5)
              ═══════════════════════════════════════════════════════════ */}
          <div
            className={cn(
              "lg:col-span-5 lg:sticky lg:top-20 space-y-5",
              activeTab === "form" ? "hidden lg:block" : "block"
            )}
          >
            {/* Live Preview Header */}
            <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-md shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-foreground">Live Attendee Preview</h3>
                </div>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[10px] px-2 py-0.5 gap-1 font-semibold"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Real-time sync
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                This is the exact interactive card student builders will see in the discovery catalog and on campus feeds.
              </p>
            </div>

            {/* The Actual Real-time HackathonCard */}
            <div className="relative group">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-indigo-500/10 to-teal-500/20 blur-md opacity-60 group-hover:opacity-90 transition-opacity pointer-events-none" />
              <div className="relative">
                <HackathonCard hackathon={previewHackathon} />
              </div>
            </div>

            {/* Event Distribution Metadata Card */}
            <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3 text-xs">
              <div className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                <span>Publishing & Discovery Attributes</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-card/60 border border-border/40">
                  <span className="text-muted-foreground block text-[10px]">Stream</span>
                  <span className="font-semibold text-indigo-300">Community / Campus</span>
                </div>

                <div className="p-2 rounded-lg bg-card/60 border border-border/40">
                  <span className="text-muted-foreground block text-[10px]">Verification</span>
                  <span className="font-semibold text-emerald-400">Instant Verified</span>
                </div>

                <div className="p-2 rounded-lg bg-card/60 border border-border/40">
                  <span className="text-muted-foreground block text-[10px]">Target Campus</span>
                  <span className="font-semibold text-foreground truncate block">
                    {collegeSlug || "All Colleges"}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-card/60 border border-border/40">
                  <span className="text-muted-foreground block text-[10px]">Location</span>
                  <span className="font-semibold text-foreground truncate block">
                    {city}, {state}
                  </span>
                </div>
              </div>

              <div className="pt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Protected against loopback and SSRF risks. Public URLs only.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
