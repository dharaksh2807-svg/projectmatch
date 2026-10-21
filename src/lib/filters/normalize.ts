/**
 * ProjectMatch Filter & Normalization Engine
 * 
 * Provides canonical normalization, alias mapping, category taxonomy,
 * and deterministic ANY / ALL matching predicates for technologies, skills, and roles.
 */

// ── Canonical Alias Mapping ──────────────────────────────────────────────────
export const TECH_ALIASES: Record<string, string> = {
  // Frontend
  react: "React",
  reactjs: "React",
  "react.js": "React",
  next: "Next.js",
  nextjs: "Next.js",
  "next.js": "Next.js",
  vue: "Vue.js",
  vuejs: "Vue.js",
  "vue.js": "Vue.js",
  angular: "Angular",
  angularjs: "Angular",
  svelte: "Svelte",
  sveltekit: "SvelteKit",
  tailwind: "Tailwind CSS",
  tailwindcss: "Tailwind CSS",
  "tailwind css": "Tailwind CSS",

  // Languages
  typescript: "TypeScript",
  ts: "TypeScript",
  javascript: "JavaScript",
  js: "JavaScript",
  python: "Python",
  py: "Python",
  golang: "Go",
  go: "Go",
  rust: "Rust",
  java: "Java",
  cpp: "C++",
  "c++": "C++",
  csharp: "C#",
  "c#": "C#",
  kotlin: "Kotlin",
  swift: "Swift",
  dart: "Dart",

  // Backend
  node: "Node.js",
  nodejs: "Node.js",
  "node.js": "Node.js",
  express: "Express",
  expressjs: "Express",
  nestjs: "NestJS",
  fastapi: "FastAPI",
  django: "Django",
  flask: "Flask",
  springboot: "Spring Boot",
  "spring boot": "Spring Boot",
  rails: "Ruby on Rails",
  "ruby on rails": "Ruby on Rails",

  // Databases
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  mongo: "MongoDB",
  mongodb: "MongoDB",
  mysql: "MySQL",
  redis: "Redis",
  supabase: "Supabase",
  firebase: "Firebase",
  sqlite: "SQLite",
  prisma: "Prisma",

  // AI & ML
  pytorch: "PyTorch",
  tensorflow: "TensorFlow",
  tf: "TensorFlow",
  langchain: "LangChain",
  huggingface: "Hugging Face",
  "hugging face": "Hugging Face",
  openai: "OpenAI",
  gemini: "Gemini",
  claude: "Claude",
  ollama: "Ollama",
  llamaindex: "LlamaIndex",

  // Cloud & DevOps
  aws: "AWS",
  gcp: "GCP",
  azure: "Azure",
  docker: "Docker",
  k8s: "Kubernetes",
  kubernetes: "Kubernetes",
  vercel: "Vercel",
  "github actions": "GitHub Actions",
  cicd: "CI/CD",
  "ci/cd": "CI/CD",

  // Mobile
  reactnative: "React Native",
  "react native": "React Native",
  flutter: "Flutter",
  ios: "iOS",
  android: "Android",

  // Web3
  solidity: "Solidity",
  ethereum: "Ethereum",
  eth: "Ethereum",
  web3: "Web3",
  ethers: "Ethers.js",
  "ethers.js": "Ethers.js",
  wagmi: "Wagmi",

  // Hardware / IoT
  arduino: "Arduino",
  raspberrypi: "Raspberry Pi",
  "raspberry pi": "Raspberry Pi",
  esp32: "ESP32",
  robotics: "Robotics",
};

/**
 * Normalizes a tech or skill string to its canonical display representation
 */
export function normalizeTag(tag: string): string {
  const clean = tag.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  if (!clean) return tag.trim();

  // Check alias lookup
  if (TECH_ALIASES[clean]) {
    return TECH_ALIASES[clean];
  }
  const fullClean = tag.toLowerCase().trim();
  if (TECH_ALIASES[fullClean]) {
    return TECH_ALIASES[fullClean];
  }

  // Preserve casing if already title-cased, else return trimmed
  return tag.trim();
}

/**
 * Checks whether candidate string matches target string using fuzzy punctuation
 * and alias awareness.
 */
export function tagMatches(candidate: string, target: string): boolean {
  const c = candidate.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (!c || !t) return false;
  if (c === t) return true;

  // Normalized tag comparison
  const cNorm = normalizeTag(c).toLowerCase();
  const tNorm = normalizeTag(t).toLowerCase();
  if (cNorm === tNorm) return true;

  const cClean = c.replace(/[^a-z0-9]/g, "");
  const tClean = t.replace(/[^a-z0-9]/g, "");
  if (cClean && tClean && cClean === tClean) return true;

  // Handle word boundaries (e.g., "tailwind" vs "tailwind css")
  const cWords = c.split(/[\s\-_/.]+/).filter(Boolean);
  const tWords = t.split(/[\s\-_/.]+/).filter(Boolean);
  if (cWords.includes(t) || tWords.includes(c)) return true;

  // Handle common extensions like "react" vs "reactjs" or "next" vs "nextjs"
  if (cClean.length >= 3 && tClean.length >= 3) {
    if (cClean === tClean + "js" || tClean === cClean + "js") return true;
    if (cClean === tClean + "ts" || tClean === cClean + "ts") return true;
  }

  return false;
}

/**
 * Evaluates filter list against target list in ANY or ALL matching mode.
 * - ANY mode: returns true if at least ONE filter item matches target items.
 * - ALL mode: returns true if EVERY filter item matches at least one target item.
 */
export function matchesTagList(
  filterItems: string[],
  targetItems: string[],
  mode: "any" | "all" = "any"
): boolean {
  if (filterItems.length === 0) return true;
  if (targetItems.length === 0) return false;

  if (mode === "all") {
    return filterItems.every((fItem) =>
      targetItems.some((tItem) => tagMatches(fItem, tItem))
    );
  }

  // Default "any" mode
  return filterItems.some((fItem) =>
    targetItems.some((tItem) => tagMatches(fItem, tItem))
  );
}

// ── Categorized Tech Stack Taxonomy ──────────────────────────────────────────
export const TECH_TAXONOMY = {
  "Frontend Frameworks": [
    "React",
    "Next.js",
    "Vue.js",
    "Angular",
    "Svelte",
    "Tailwind CSS",
    "HTML/CSS",
    "Redux",
  ],
  "Backend Frameworks": [
    "Node.js",
    "Express",
    "NestJS",
    "FastAPI",
    "Django",
    "Flask",
    "Spring Boot",
    "Go",
    "Ruby on Rails",
  ],
  "Programming Languages": [
    "TypeScript",
    "JavaScript",
    "Python",
    "Go",
    "Rust",
    "Java",
    "C++",
    "C#",
    "Kotlin",
    "Swift",
  ],
  "Databases & ORMs": [
    "PostgreSQL",
    "MongoDB",
    "MySQL",
    "Redis",
    "Supabase",
    "Firebase",
    "SQLite",
    "Prisma",
  ],
  "AI & ML Frameworks": [
    "PyTorch",
    "TensorFlow",
    "LangChain",
    "Hugging Face",
    "OpenAI",
    "Gemini",
    "Claude",
    "Ollama",
    "LlamaIndex",
  ],
  "Cloud & DevOps": [
    "AWS",
    "GCP",
    "Azure",
    "Docker",
    "Kubernetes",
    "Vercel",
    "GitHub Actions",
    "CI/CD",
  ],
  "Mobile Development": [
    "React Native",
    "Flutter",
    "iOS",
    "Android",
    "Swift",
    "Kotlin",
  ],
  "Web3 & Blockchain": [
    "Solidity",
    "Ethereum",
    "Smart Contracts",
    "Web3.js",
    "Ethers.js",
    "Wagmi",
  ],
  "Hardware & IoT": [
    "Arduino",
    "Raspberry Pi",
    "ESP32",
    "Embedded C",
    "Robotics",
    "Sensors",
  ],
};

// Flattened list of all predefined technologies
export const ALL_PREDEFINED_TECHS = Object.values(TECH_TAXONOMY).flat();

// ── Standard Skills Taxonomy (Strictly separated from technologies) ───────────
export const STANDARD_SKILLS = [
  "Frontend Development",
  "Backend Development",
  "Full-Stack Development",
  "API Integration",
  "Machine Learning",
  "Data Science",
  "AI Agent Development",
  "UI/UX Design",
  "Product Management",
  "Security",
  "Testing",
  "Deployment",
  "Pitching and Presentations",
];

// ── Role Categories ──────────────────────────────────────────────────────────
export const ROLE_CATEGORIES = [
  { label: "All Roles", value: "All" },
  { label: "Frontend Developer", value: "frontend" },
  { label: "Backend Developer", value: "backend" },
  { label: "Full-Stack Developer", value: "fullstack" },
  { label: "AI / ML Engineer", value: "aiml" },
  { label: "UI / UX Designer", value: "design" },
  { label: "Mobile Developer", value: "mobile" },
  { label: "Cloud / DevOps", value: "devops" },
  { label: "Product Manager", value: "product" },
  { label: "Security & Testing", value: "security" },
];

/**
 * Checks if a role matches a role category
 */
export function matchesRoleCategory(
  roleTitle: string,
  roleDesc: string | null | undefined,
  requiredSkills: string[],
  category: string
): boolean {
  if (!category || category === "All") return true;

  const titleLower = roleTitle.toLowerCase();
  const skillsLower = requiredSkills.map((s) => s.toLowerCase());
  const descLower = (roleDesc || "").toLowerCase();

  const titleOrSkills = `${titleLower} ${skillsLower.join(" ")}`;
  const fullText = `${titleOrSkills} ${descLower}`;

  const hasWord = (regex: RegExp, text: string) => regex.test(text);

  switch (category) {
    case "frontend":
      return (
        hasWord(/\b(frontend|front-end|ui developer|web developer)\b/i, titleOrSkills) ||
        skillsLower.some((s) => ["react", "vue", "next.js", "tailwind css", "html/css", "frontend development"].includes(s)) ||
        hasWord(/\b(frontend|front-end)\b/i, descLower)
      );
    case "backend":
      return (
        hasWord(/\b(backend|back-end|api engineer|api developer|server engineer)\b/i, titleOrSkills) ||
        skillsLower.some((s) => ["node.js", "fastapi", "django", "express", "backend development", "postgresql"].includes(s)) ||
        hasWord(/\b(backend|back-end)\b/i, descLower)
      );
    case "fullstack":
      return (
        hasWord(/\b(fullstack|full-stack|full stack)\b/i, fullText) ||
        skillsLower.includes("full-stack development")
      );
    case "aiml":
      return (
        hasWord(/\b(ai|ml|machine learning|deep learning|data scientist|ai agent|prompt engineer|nlp|llm|computer vision)\b/i, titleOrSkills) ||
        skillsLower.some((s) => ["machine learning", "data science", "ai agent development", "langchain", "pytorch", "tensorflow", "gemini", "openai"].includes(s)) ||
        hasWord(/\b(machine learning|deep learning|ai agent|llm)\b/i, descLower)
      );
    case "design":
      return (
        hasWord(/\b(design|designer|ux|ui|ui\/ux|product designer)\b/i, titleOrSkills) ||
        skillsLower.some((s) => ["ui/ux design", "figma", "prototyping"].includes(s)) ||
        hasWord(/\b(ui\/ux|design systems|wireframing)\b/i, descLower)
      );
    case "mobile":
      return (
        hasWord(/\b(mobile|ios|android|flutter|react native|swift|kotlin)\b/i, titleOrSkills) ||
        skillsLower.some((s) => ["react native", "flutter", "ios", "android"].includes(s))
      );
    case "devops":
      return (
        hasWord(/\b(devops|cloud|sre|infrastructure|platform engineer)\b/i, titleOrSkills) ||
        skillsLower.some((s) => ["docker", "kubernetes", "aws", "gcp", "azure", "deployment"].includes(s)) ||
        hasWord(/\b(devops|ci\/cd|kubernetes)\b/i, descLower)
      );
    case "product":
      return (
        hasWord(/\b(product|pm|product manager|scrum|team lead)\b/i, titleOrSkills) ||
        skillsLower.includes("product management")
      );
    case "security":
      return (
        hasWord(/\b(security|qa|testing|tester|cybersecurity|infosec)\b/i, titleOrSkills) ||
        skillsLower.some((s) => ["security", "testing"].includes(s)) ||
        hasWord(/\b(penetration testing|cybersecurity)\b/i, descLower)
      );
    default:
      return fullText.includes(category.toLowerCase());
  }
}
