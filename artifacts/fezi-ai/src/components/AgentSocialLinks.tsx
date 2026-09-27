import { ExternalLink, Globe2, Linkedin } from "lucide-react";
import { SiFacebook, SiInstagram, SiThreads, SiTiktok, SiX } from "react-icons/si";

export type AgentSocialLink = {
  platform: "instagram" | "threads" | "facebook" | "x" | "tiktok" | "linkedin" | "website" | "other";
  label: string;
  url: string;
};

const icons = {
  instagram: SiInstagram,
  threads: SiThreads,
  facebook: SiFacebook,
  x: SiX,
  tiktok: SiTiktok,
  linkedin: Linkedin,
  website: Globe2,
  other: ExternalLink,
};

export function AgentSocialLinks({
  links,
  title,
  compact = false,
}: {
  links?: AgentSocialLink[];
  title?: string;
  compact?: boolean;
}) {
  if (!links?.length) return null;

  return (
    <div data-testid="list-agent-social-links">
      {title && <h4 className="mb-3 text-sm font-semibold">{title}</h4>}
      <div className="flex flex-wrap gap-2">
        {links.map((link, index) => {
          const Icon = icons[link.platform] ?? ExternalLink;
          return (
            <a
              key={`${link.platform}-${link.url}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${link.platform}: ${link.label}`}
              title={`${link.platform}: ${link.label}`}
              data-testid={`link-agent-social-${link.platform}-${index}`}
              className={`inline-flex items-center rounded-xl border border-border bg-background/70 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary ${
                compact ? "h-9 w-9 justify-center" : "min-h-10 gap-2 px-3 py-2 text-xs font-medium"
              }`}
            >
              <Icon size={16} aria-hidden="true" />
              {!compact && <span dir="ltr">{link.label}</span>}
            </a>
          );
        })}
      </div>
    </div>
  );
}