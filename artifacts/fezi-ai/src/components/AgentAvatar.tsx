import agentPortraitGrid from '@/assets/agent-portraits-grid.png';
import monicahPortrait from '@/assets/monicah-portrait.png';

type AgentAvatarProps = {
  agentId: string;
  name?: string;
  className?: string;
};

const cropPosition: Record<string, string> = {
  arta: 'left-0 top-0',
  arvin: 'left-[-100%] top-0',
  negar: 'left-0 top-[-100%]',
  fezi: 'left-[-100%] top-[-100%]',
};

export function AgentAvatar({ agentId, name = 'Agent', className = '' }: AgentAvatarProps) {
  const alt = `${name} portrait`;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {agentId === 'monicah' ? (
        <img src={monicahPortrait} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <img
          src={agentPortraitGrid}
          alt={alt}
          className={`absolute h-[200%] w-[200%] max-w-none ${cropPosition[agentId] || 'left-0 top-0'}`}
        />
      )}
    </div>
  );
}