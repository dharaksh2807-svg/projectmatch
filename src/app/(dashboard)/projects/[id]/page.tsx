"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import sanitizeHtml from "sanitize-html";
import { formatDistanceToNow } from "date-fns";
import {
  Clock,
  GitBranch,
  Globe,
  Tag,
  Users,
  ChevronLeft,
  Loader2,
  Send,
  MessageSquare,
  Link as LinkIcon,
  UserPlus,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-provider";
import { ReputationBadge } from "@/components/ratings/reputation-badge";
import { ReportModal } from "@/components/shared/report-modal";
import { GoogleDriveIcon } from "@/components/shared/social-icons";
import { ApplyModal } from "@/components/applications/apply-modal";
import {
  ContextualChatDrawer,
  type ContextualChatContext,
} from "@/components/chat/contextual-chat-drawer";
import { InviteModal } from "@/components/invitations/invite-modal";
import { ProjectInvitationsList } from "@/components/invitations/project-invitations-list";

interface Role {
  id: string;
  title: string;
  description: string | null;
  requiredSkills: string[];
  requiredExperienceLevel: string;
  timeCommitment: string;
  headcount: number;
  filledCount: number;
  isOpen: boolean;
  _count: { applications: number };
}

interface Project {
  id: string;
  title: string;
  description: string;
  projectType: string;
  duration: string;
  techStack: string[];
  repoUrl: string | null;
  websiteUrl: string | null;
  driveUrl: string | null;
  isPublished: boolean;
  createdAt: string;
  ownerId: string;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
    reputationScore: number;
    bio: string | null;
  };
  roles: Role[];
  _count: { applications: number };
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: session, status: sessionStatus } = useSession();
  const { toast } = useToast();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRoleForApply, setSelectedRoleForApply] = useState<Role | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [activeChatContext, setActiveChatContext] = useState<ContextualChatContext | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedRoleForInvite, setSelectedRoleForInvite] = useState<string | null>(null);

  useEffect(() => {
    async function loadProject() {
      try {
        const res = await fetch(`/api/projects/${id}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Project not found");
          throw new Error("Failed to load project");
        }
        const data = await res.json();
        setProject(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadProject();
  }, [id]);

  const onOpenApplyModal = (role: Role) => {
    if (sessionStatus !== "authenticated") {
      toast("Please log in to apply.", "info");
      router.push("/login");
      return;
    }
    setSelectedRoleForApply(role);
    setIsApplyModalOpen(true);
  };

  const handleOpenChat = () => {
    if (sessionStatus !== "authenticated") {
      toast("Please log in to message the lead.", "info");
      router.push("/login");
      return;
    }
    if (!project) return;
    setActiveChatContext({
      recipientId: project.ownerId,
      recipientName: project.owner.name,
      recipientImage: project.owner.image,
      projectId: project.id,
      projectTitle: project.title,
    });
    setChatDrawerOpen(true);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">{error || "Project not found"}</h1>
        <Link href="/discover"><Button variant="outline">Back to Discover</Button></Link>
      </div>
    );
  }

  const isOwner = session?.user?.id === project.ownerId;

  return (
    <div className="min-h-screen bg-background p-3.5 sm:p-6 md:p-8 animate-fade-in pb-20 min-w-0 overflow-x-hidden">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/discover");
            }
          }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Discover
        </button>

        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          {/* Main Content */}
          <div className="space-y-8">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{project.projectType}</Badge>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {project.duration}
                </span>
                {!project.isPublished && (
                  <Badge variant="warning">Draft</Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4">{project.title}</h1>
              <div 
                className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap prose-p:my-1 prose-ul:my-1"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.description) }}
              />
            </div>

            {project.techStack.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4" /> Tech Stack
                </h3>
                <div className="flex flex-wrap gap-2">
                  {project.techStack.map(tech => (
                    <Badge key={tech} variant="secondary" className="bg-secondary/50">{tech}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" /> Open Roles ({project.roles.length})
              </h3>
              <div className="space-y-4">
                {project.roles.map(role => (
                  <Card key={role.id} className="border-border/60 bg-card/40">
                    <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 sm:gap-6">
                      <div className="space-y-3 flex-1 min-w-0">
                        <div>
                          <h4 className="text-base sm:text-lg font-semibold">{role.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {role.requiredExperienceLevel} • {role.timeCommitment}
                          </p>
                        </div>
                        
                        {role.requiredSkills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {role.requiredSkills.map(s => (
                              <Badge key={s} variant="outline" className="text-[10px] h-5">{s}</Badge>
                            ))}
                          </div>
                        )}
                        
                        <div className="text-xs text-muted-foreground mt-2">
                          {role.filledCount} / {role.headcount} filled
                          {isOwner && ` • ${role._count.applications} applications`}
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0 w-full md:w-auto">
                        {isOwner ? (
                          <div className="flex items-center gap-2 w-full md:w-auto">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRoleForInvite(role.id);
                                setIsInviteModalOpen(true);
                              }}
                              className="w-full md:w-auto min-h-[44px] gap-1.5 cursor-pointer border-primary/30 text-primary hover:bg-primary/10"
                            >
                              <LinkIcon className="w-3.5 h-3.5" /> Invite
                            </Button>
                            <Link href="/applications" className="block w-full md:w-auto">
                              <Button variant="outline" size="sm" className="w-full md:w-auto min-h-[44px]">
                                View Apps
                              </Button>
                            </Link>
                          </div>
                        ) : !role.isOpen || role.filledCount >= role.headcount ? (
                          <Badge variant="secondary" className="px-3 py-1 bg-muted w-full md:w-auto text-center justify-center">Role Filled</Badge>
                        ) : (
                          <Button 
                            className="brand-gradient text-white gap-2 w-full md:w-auto min-h-[44px]"
                            onClick={() => onOpenApplyModal(role)}
                          >
                            <Send className="w-4 h-4" />
                            Apply Now
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Team Invitations Management Section for Project Owner */}
            {isOwner && (
              <div className="pt-2">
                <ProjectInvitationsList
                  projectId={project.id}
                  projectTitle={project.title}
                  roles={project.roles}
                />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="border-border/60">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">Project Lead</h3>
                <div className="flex items-center gap-3">
                  <Avatar src={project.owner.image} alt={project.owner.name || "Owner"} size="md" />
                  <div>
                    <div className="font-medium">{project.owner.name}</div>
                    <ReputationBadge score={project.owner.reputationScore} size="sm" />
                  </div>
                </div>
                {project.owner.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-3">{project.owner.bio}</p>
                )}
                {!isOwner && session?.user?.id && (
                  <Button
                    variant="outline"
                    onClick={handleOpenChat}
                    className="w-full gap-2 border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" /> Message Lead
                  </Button>
                )}
                <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                  Posted {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                </div>
              </CardContent>
            </Card>

            {(project.repoUrl || project.websiteUrl || project.driveUrl) && (
              <Card className="border-border/60">
                <CardContent className="p-5 space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Links & Documents</h3>
                  {project.repoUrl && (
                    <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                      <GitBranch className="w-4 h-4" /> GitHub Repository
                    </a>
                  )}
                  {project.websiteUrl && (
                    <a href={project.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                      <Globe className="w-4 h-4" /> Live Website
                    </a>
                  )}
                  {project.driveUrl && (
                    <a href={project.driveUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors">
                      <GoogleDriveIcon className="w-4 h-4 flex-shrink-0 text-blue-500" /> Project Specs / Slides (Drive)
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
            
            {isOwner && (
              <div className="pt-4 space-y-2">
                <Button
                  onClick={() => {
                    setSelectedRoleForInvite(null);
                    setIsInviteModalOpen(true);
                  }}
                  className="w-full brand-gradient text-white gap-2 font-semibold shadow-xs cursor-pointer min-h-[40px]"
                >
                  <UserPlus className="w-4 h-4" /> Invite Teammate
                </Button>
                <Link href={`/projects/${project.id}/edit`}>
                  <Button variant="outline" className="w-full">
                    Edit Project
                  </Button>
                </Link>
                {project.isPublished ? (
                   <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10">Archive Project</Button>
                ) : (
                   <Button className="w-full brand-gradient text-white">Publish Now</Button>
                )}
              </div>
            )}

            {session?.user?.id && !isOwner && (
              <div className="pt-4 flex justify-end">
                <ReportModal projectId={project.id} targetName={project.title} />
              </div>
            )}
          </div>
        </div>
      </div>

      <ApplyModal
        isOpen={isApplyModalOpen}
        onClose={() => {
          setIsApplyModalOpen(false);
          setSelectedRoleForApply(null);
        }}
        role={selectedRoleForApply}
        projectId={project.id}
        projectTitle={project.title}
        onSuccess={() => {
          // Re-fetch project to update counts if needed
          fetch(`/api/projects/${id}`)
            .then((res) => res.json())
            .then((data) => setProject(data))
            .catch(() => {});
        }}
      />

      <ContextualChatDrawer
        isOpen={chatDrawerOpen}
        onClose={() => setChatDrawerOpen(false)}
        context={activeChatContext}
      />

      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          setSelectedRoleForInvite(null);
        }}
        projectId={project.id}
        projectTitle={project.title}
        roles={project.roles}
        defaultRoleId={selectedRoleForInvite}
        onSuccess={() => {
          // Refresh project details
          fetch(`/api/projects/${id}`)
            .then((res) => res.json())
            .then((data) => setProject(data))
            .catch(() => {});
        }}
      />
    </div>
  );
}
