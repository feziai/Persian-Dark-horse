import { useState, useMemo } from 'react';
import { useLocalStore } from '../lib/store';
import { useTranslation } from '../lib/i18n';
import { PageHeader, Card, Button, Input, Label, Textarea } from '../components/ui-parts';
import { Plus, Trash2, Edit2, Check, X, FolderOpen, Import, MessageSquare, Bot, ExternalLink, ChevronLeft, Calendar, AlertCircle } from 'lucide-react';
import {
  useListProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useListChatConversations,
  useRenameChatConversation,
  useListAgents,
  useListCustomAgents,
  getListProjectsQueryKey,
  getListChatConversationsQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';

export default function ProjectsPage() {
  const { t, isRtl } = useTranslation();
  const queryClient = useQueryClient();
  const { projects: localProjects, deleteProject: deleteLocalProject } = useLocalStore();

  // Remote queries
  const { data: remoteProjectsData, isLoading: isLoadingProjects, isError: isErrorProjects } = useListProjects();
  const { data: convData, isLoading: isLoadingConvs, isError: isErrorConvs } = useListChatConversations();
  const { data: builtinAgents, isLoading: isLoadingBuiltin, isError: isErrorBuiltin } = useListAgents();
  const { data: customAgentsData, isLoading: isLoadingCustom, isError: isErrorCustom } = useListCustomAgents();

  const isLoadingAgents = isLoadingBuiltin || isLoadingCustom;
  const isErrorAgents = isErrorBuiltin || isErrorCustom;

  const remoteProjects = remoteProjectsData?.projects || [];

  const allAgents = useMemo(() => {
    const builtin = builtinAgents || [];
    const custom = customAgentsData?.agents || [];
    return [...builtin, ...custom];
  }, [builtinAgents, customAgentsData]);

  const allConvs = convData?.conversations || [];

  // Mutations
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const renameConv = useRenameChatConversation();

  // State
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', status: 'active' as 'active' | 'archived' | 'completed' });

  // Errors and notices
  const [actionError, setActionError] = useState('');
  const [importError, setImportError] = useState('');
  const [importNote, setImportNote] = useState('');

  // Details state
  const [selectedChatToAdd, setSelectedChatToAdd] = useState('');
  const [selectedAgentToAdd, setSelectedAgentToAdd] = useState('');


  const exactDuplicates = useMemo(() => {
    return localProjects.filter(lp =>
      remoteProjects.some(rp =>
        rp.name === lp.name &&
        (rp.description || '') === (lp.description || '') &&
        rp.status === lp.status
      )
    );
  }, [localProjects, remoteProjects]);

  const [isClearingDuplicates, setIsClearingDuplicates] = useState(false);

  const handleClearDuplicates = () => {
    exactDuplicates.forEach(lp => {
      deleteLocalProject(lp.id);
    });
    setIsClearingDuplicates(false);
    setImportNote(isRtl ? 'پروژه‌های تکراری با موفقیت پاک شدند.' : 'Duplicate projects successfully cleared.');
  };


  const activeProject = selectedProjectId ? remoteProjects.find(p => p.id === selectedProjectId) : null;

  const handleSaveProject = (id?: string) => {
    const name = formData.name.trim();
    const description = formData.description.trim();
    if (!name) {
      setActionError(isRtl ? 'نام پروژه الزامی است.' : 'Project name is required.');
      return;
    }
    setActionError('');

    if (id) {
      updateProject.mutate({
        projectId: id,
        data: { name, description, status: formData.status }
      }, {
        onSuccess: (data) => {
          setEditingId(null);
          queryClient.setQueryData(getListProjectsQueryKey(), (old: any) => {
            if (!old) return old;
            return {
              ...old,
              projects: old.projects.map((p: any) => p.id === id ? { ...p, ...data.project } : p)
            };
          });
        },
        onError: () => setActionError(isRtl ? 'بروزرسانی پروژه با خطا مواجه شد.' : 'Failed to update project.')
      });
    } else {
      createProject.mutate({
        data: { name, description, status: formData.status }
      }, {
        onSuccess: () => {
          setIsAdding(false);
          setFormData({ name: '', description: '', status: 'active' });
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        },
        onError: () => setActionError(isRtl ? 'ایجاد پروژه با خطا مواجه شد.' : 'Failed to create project.')
      });
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setImportError('');
    setImportNote('');
    let skipped = 0;
    let failed = 0;

    const processedSignatures = new Set<string>();
    remoteProjects.forEach(rp => processedSignatures.add(JSON.stringify([rp.name, rp.description || '', rp.status])));

    for (const lp of localProjects) {
      const sig = JSON.stringify([lp.name, lp.description || '', lp.status]);
      if (processedSignatures.has(sig)) {
        skipped++;
        continue;
      }

      try {
        await createProject.mutateAsync({
          data: { name: lp.name, description: lp.description, status: lp.status as any }
        });
        deleteLocalProject(lp.id);
        processedSignatures.add(sig);
      } catch (err) {
        failed++;
      }
    }

    if (failed > 0) {
      setImportError(isRtl ? 'وارد کردن برخی پروژه‌ها با خطا مواجه شد.' : 'Failed to import some projects.');
    }
    if (skipped > 0) {
      setImportNote(isRtl ? `${skipped} پروژه نادیده گرفته شد (از قبل وجود داشت یا در این دسته تکراری بود).` : `${skipped} project(s) were skipped (already existed or duplicate in batch).`);
    }

    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    setImporting(false);
  };

  const confirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionError('');
    deleteProject.mutate({ projectId: id }, {
      onSuccess: () => {
        setDeletingId(null);
        if (selectedProjectId === id) setSelectedProjectId(null);
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
      onError: () => setActionError(isRtl ? 'حذف پروژه با خطا مواجه شد.' : 'Failed to delete project.')
    });
  };

  const handleAddChat = (convId: string) => {
    if (!activeProject || !convId) return;
    setActionError('');
    const newIds = Array.from(new Set([...(activeProject.conversationIds || []), convId]));
    updateProject.mutate({
      projectId: activeProject.id,
      data: { conversationIds: newIds }
    }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getListProjectsQueryKey(), (old: any) => {
          if (!old) return old;
          return { ...old, projects: old.projects.map((p: any) => p.id === activeProject.id ? data.project : p) };
        });
        setSelectedChatToAdd('');
      },
      onError: () => setActionError(isRtl ? 'افزودن چت با خطا مواجه شد.' : 'Failed to attach chat.')
    });
  };

  const handleRemoveChat = (convId: string) => {
    if (!activeProject) return;
    setActionError('');
    const newIds = (activeProject.conversationIds || []).filter(id => id !== convId);
    updateProject.mutate({
      projectId: activeProject.id,
      data: { conversationIds: newIds }
    }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getListProjectsQueryKey(), (old: any) => {
          if (!old) return old;
          return { ...old, projects: old.projects.map((p: any) => p.id === activeProject.id ? data.project : p) };
        });
      },
      onError: () => setActionError(isRtl ? 'حذف چت با خطا مواجه شد.' : 'Failed to remove chat.')
    });
  };

  const handleAddAgent = (agentId: string) => {
    if (!activeProject || !agentId) return;
    setActionError('');
    const newIds = Array.from(new Set([...(activeProject.agentIds || []), agentId]));
    updateProject.mutate({
      projectId: activeProject.id,
      data: { agentIds: newIds }
    }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getListProjectsQueryKey(), (old: any) => {
          if (!old) return old;
          return { ...old, projects: old.projects.map((p: any) => p.id === activeProject.id ? data.project : p) };
        });
        setSelectedAgentToAdd('');
      },
      onError: () => setActionError(isRtl ? 'افزودن عامل با خطا مواجه شد.' : 'Failed to assign agent.')
    });
  };

  const handleRemoveAgent = (agentId: string) => {
    if (!activeProject) return;
    setActionError('');
    const newIds = (activeProject.agentIds || []).filter(id => id !== agentId);
    updateProject.mutate({
      projectId: activeProject.id,
      data: { agentIds: newIds }
    }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getListProjectsQueryKey(), (old: any) => {
          if (!old) return old;
          return { ...old, projects: old.projects.map((p: any) => p.id === activeProject.id ? data.project : p) };
        });
      },
      onError: () => setActionError(isRtl ? 'حذف عامل با خطا مواجه شد.' : 'Failed to remove agent.')
    });
  };

  const handleRenameChat = (convId: string, newTitle: string, onSuccess: () => void, onError: () => void) => {
    renameConv.mutate({ conversationId: convId, data: { title: newTitle } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChatConversationsQueryKey() });
        onSuccess();
      },
      onError: () => onError()
    });
  };

  const startEdit = (p: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActionError('');
    setFormData({ name: p.name, description: p.description, status: p.status });
    setEditingId(p.id);
    setIsAdding(false);
  };

  // DETAIL VIEW
  if (selectedProjectId) {
    if (isLoadingProjects) return <div className="text-center py-20 text-muted-foreground">{isRtl ? 'در حال بارگذاری جزئیات پروژه...' : 'Loading project details...'}</div>;
    if (!activeProject) {
      return (
        <div className="max-w-4xl mx-auto space-y-6 pt-10 text-center">
          <p className="text-muted-foreground mb-4">{isRtl ? 'پروژه یافت نشد یا حذف شده است.' : 'Project not found or deleted.'}</p>
          <Button onClick={() => setSelectedProjectId(null)}>{isRtl ? 'بازگشت به پروژه‌ها' : 'Back to Projects'}</Button>
        </div>
      );
    }

    const p = activeProject;

    return (
       <div className="fade-up mx-auto max-w-5xl min-w-0 space-y-6">
         <div className="mb-6 flex flex-wrap items-center gap-3 sm:gap-4">
           <Button variant="ghost" className="min-h-11 min-w-11 px-2 sm:min-h-0 sm:min-w-0" onClick={() => { setSelectedProjectId(null); setActionError(''); }}><ChevronLeft size={20}/></Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">{p.name}</h1>
             <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                p.status === 'active' ? 'bg-green-500/20 text-green-400' :
                p.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                'bg-surface-hover text-muted-foreground'
              }`}>
                {t(p.status as any) || (p.status === 'active' ? (isRtl ? 'فعال' : 'Active') : p.status === 'archived' ? (isRtl ? 'بایگانی' : 'Archived') : (isRtl ? 'تکمیل شده' : 'Completed'))}
              </span>
              <span>{isRtl ? 'بروزرسانی در' : 'Updated'} {new Date(p.updatedAt).toLocaleDateString()}</span>
            </p>
          </div>
           <Button variant="secondary" className="min-h-11 w-full sm:w-auto" onClick={() => startEdit(p)} disabled={updateProject.isPending}><Edit2 size={16}/> {isRtl ? 'ویرایش اطلاعات' : 'Edit Info'}</Button>
        </div>

        {editingId === p.id && (
          <Card className="border-primary/50 border-2 mb-6">
            <div className="space-y-4">
              <div>
                <Label>{t('name')}</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <Label>{t('description')}</Label>
                <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div>
                <Label>{t('status')}</Label>
                <select
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value as any})}
                >
                  <option value="active">{t('active') || (isRtl ? 'فعال' : 'Active')}</option>
                  <option value="archived">{t('archived') || (isRtl ? 'بایگانی' : 'Archived')}</option>
                  <option value="completed">{t('completed') || (isRtl ? 'تکمیل شده' : 'Completed')}</option>
                </select>
              </div>
              {actionError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={14}/> {actionError}</p>}
              <div className="flex gap-2 pt-2">
                <Button onClick={() => handleSaveProject(p.id)} disabled={updateProject.isPending}><Check size={16} className="shrink-0"/> {t('save')}</Button>
                <Button variant="ghost" onClick={() => { setEditingId(null); setActionError(''); }} disabled={updateProject.isPending}><X size={16} className="shrink-0"/> {t('cancel')}</Button>
              </div>
            </div>
          </Card>
        )}

        {p.description && !editingId && (
          <div className="bg-surface/30 border border-border rounded-2xl p-5 mb-8 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {p.description}
          </div>
        )}

        {actionError && !editingId && <div className="text-sm text-red-400 mb-4 p-3 bg-red-900/10 rounded-xl border border-red-900/30 flex items-center gap-2"><AlertCircle size={16}/> {actionError}</div>}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Chats Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><MessageSquare size={18} className="text-primary"/> {isRtl ? 'چت‌های ذخیره شده' : 'Saved Chats'}</h3>
            <Card className="p-4 bg-surface/30 border border-border/50 space-y-3">
              {isLoadingConvs ? (
                <div className="text-center py-4 text-muted-foreground text-sm">{isRtl ? 'در حال بارگذاری چت‌ها...' : 'Loading chats...'}</div>
              ) : isErrorConvs ? (
                <div className="text-center py-4 text-red-400 text-sm">{isRtl ? 'خطا در دریافت چت‌ها.' : 'Failed to load chats.'}</div>
              ) : (p.conversationIds || []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground/60 flex flex-col items-center">
                  <MessageSquare size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">{isRtl ? 'هیچ چتی به این پروژه متصل نیست.' : 'No chats attached to this project.'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(p.conversationIds || []).map(id => {
                    const chat = allConvs.find(c => c.id === id);
                    return <AttachedChatRow key={id} chat={chat} id={id} onRemove={handleRemoveChat} onRename={handleRenameChat} disabled={updateProject.isPending || renameConv.isPending} isRtl={isRtl} />
                  })}
                </div>
              )}

              <div className="pt-4 mt-2 border-t border-border/50">
                <Label>{isRtl ? 'افزودن چت موجود' : 'Attach Existing Chat'}</Label>
                 <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <select
                     className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50"
                    value={selectedChatToAdd}
                    onChange={e => setSelectedChatToAdd(e.target.value)}
                    disabled={updateProject.isPending || isLoadingConvs}
                  >
                    <option value="">{isRtl ? 'انتخاب چت ذخیره شده...' : 'Select a saved chat...'}</option>
                    {!isLoadingConvs && !isErrorConvs && allConvs.filter(c => !(p.conversationIds || []).includes(c.id)).map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                   <Button size="sm" className="min-h-11" onClick={() => handleAddChat(selectedChatToAdd)} disabled={!selectedChatToAdd || updateProject.isPending}>{isRtl ? 'افزودن' : 'Add'}</Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Agents Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><Bot size={18} className="text-primary"/> {isRtl ? 'عوامل پروژه' : 'Project Agents'}</h3>
            <Card className="p-4 bg-surface/30 border border-border/50 space-y-3">
              {isLoadingAgents ? (
                 <div className="text-center py-4 text-muted-foreground text-sm">{isRtl ? 'در حال بارگذاری عوامل...' : 'Loading agents...'}</div>
              ) : isErrorAgents ? (
                 <div className="text-center py-4 text-red-400 text-sm">{isRtl ? 'خطا در دریافت عوامل.' : 'Failed to load agents.'}</div>
              ) : (p.agentIds || []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground/60 flex flex-col items-center">
                  <Bot size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">{isRtl ? 'هیچ عاملی اختصاص داده نشده است.' : 'No agents assigned.'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(p.agentIds || []).map(id => {
                    const agent = allAgents.find(a => a.id === id);
                    return <AttachedAgentRow key={id} agent={agent} id={id} onRemove={handleRemoveAgent} disabled={updateProject.isPending} isRtl={isRtl} />
                  })}
                </div>
              )}

              <div className="pt-4 mt-2 border-t border-border/50">
                <Label>{isRtl ? 'اختصاص عامل' : 'Assign Agent'}</Label>
                 <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <select
                     className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50"
                    value={selectedAgentToAdd}
                    onChange={e => setSelectedAgentToAdd(e.target.value)}
                    disabled={updateProject.isPending || isLoadingAgents}
                  >
                    <option value="">{isRtl ? 'انتخاب عامل...' : 'Select an agent...'}</option>
                    {!isLoadingAgents && !isErrorAgents && allAgents.filter(a => !(p.agentIds || []).includes(a.id)).map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({('category' in a ? a.category : (isRtl ? 'عامل سیستم' : 'System Agent'))})</option>
                    ))}
                  </select>
                   <Button size="sm" className="min-h-11" onClick={() => handleAddAgent(selectedAgentToAdd)} disabled={!selectedAgentToAdd || updateProject.isPending}>{isRtl ? 'افزودن' : 'Add'}</Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
     <div className="fade-up mx-auto max-w-5xl min-w-0 space-y-6">
      <PageHeader
        title={t('proj_title') || (isRtl ? 'پروژه‌ها' : 'Projects')}
        description={t('proj_desc') || (isRtl ? 'کار خود را در فضاهای قابل مدیریت سازماندهی کنید' : 'Organize your work into manageable spaces')}
        action={
          !isAdding && <Button onClick={() => { setIsAdding(true); setActionError(''); setFormData({ name: '', description: '', status: 'active' }); }}>
            <Plus size={16} className="shrink-0" /> {t('create')}
          </Button>
        }
      />

      {localProjects.length > 0 && (
        <Card className="mb-6 border-blue-500/30 bg-blue-500/5 shadow-none p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 shrink-0"><Import size={24} /></div>
              <div>
                <h3 className="font-semibold text-blue-400 text-lg">{isRtl ? 'پروژه‌های قدیمی یافت شد' : 'Legacy Projects Found'}</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                  {isRtl
                    ? `شما ${localProjects.length} پروژه قدیمی فقط در این مرورگر دارید. آنها را به حساب خود وارد کنید تا در همه جا در دسترس باشند.`
                    : `You have ${localProjects.length} legacy project(s) saved only in this browser. Import them to your account to keep them safe and accessible everywhere.`}
                </p>
                {importError && <p className="text-xs text-red-400 mt-2 flex items-center gap-1"><AlertCircle size={14}/> {importError}</p>}
                {importNote && <p className="text-xs text-blue-400 mt-2">{importNote}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button onClick={handleImport} disabled={importing || isClearingDuplicates} className="bg-blue-500 text-white hover:bg-blue-600 border-none shadow-md shadow-blue-500/20">
                {importing ? (isRtl ? 'در حال وارد کردن...' : 'Importing...') : (isRtl ? 'وارد کردن به حساب' : 'Import to Account')}
              </Button>
              {exactDuplicates.length > 0 && (
                isClearingDuplicates ? (
                  <div className="flex flex-col items-end gap-2 bg-background/80 p-3 rounded-xl border border-border shadow-sm">
                    <p className="text-xs font-medium text-red-400 text-right">
                      {isRtl ? `حذف ${exactDuplicates.length} پروژه کاملاً تکراری از مرورگر؟` : `Clear ${exactDuplicates.length} exact duplicates from browser?`}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="danger" onClick={handleClearDuplicates}>
                        {isRtl ? 'بله، پاک کن' : 'Yes, clear'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsClearingDuplicates(false)}>
                        {isRtl ? 'لغو' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setIsClearingDuplicates(true)} disabled={importing}>
                    {isRtl ? `پاک کردن تکراری‌ها (${exactDuplicates.length})` : `Clear Duplicates (${exactDuplicates.length})`}
                  </Button>
                )
              )}
            </div>
          </div>
        </Card>
      )}

      {isAdding && (
        <Card className="border-primary/50 border-2">
          <div className="space-y-4">
            <div>
              <Label>{t('name')}</Label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus />
            </div>
            <div>
              <Label>{t('description')}</Label>
              <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <div>
              <Label>{t('status')}</Label>
              <select
                className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as any})}
              >
                <option value="active">{t('active') || (isRtl ? 'فعال' : 'Active')}</option>
                <option value="archived">{t('archived') || (isRtl ? 'بایگانی' : 'Archived')}</option>
                <option value="completed">{t('completed') || (isRtl ? 'تکمیل شده' : 'Completed')}</option>
              </select>
            </div>
            {actionError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={14}/> {actionError}</p>}
            <div className="flex gap-2 pt-2">
              <Button onClick={() => handleSaveProject()} disabled={createProject.isPending}><Check size={16} className="shrink-0"/> {t('save')}</Button>
              <Button variant="ghost" onClick={() => { setIsAdding(false); setActionError(''); }} disabled={createProject.isPending}><X size={16} className="shrink-0"/> {t('cancel')}</Button>
            </div>
          </div>
        </Card>
      )}

      {isLoadingProjects && !remoteProjectsData ? (
        <div className="text-center py-20 text-muted-foreground">{isRtl ? 'در حال بارگذاری پروژه‌ها...' : 'Loading projects...'}</div>
      ) : isErrorProjects ? (
        <Card className="p-8 text-center text-red-400 bg-red-900/10 border-red-900/30">
          <p>{isRtl ? 'بارگذاری پروژه‌ها با خطا مواجه شد. لطفاً دوباره تلاش کنید.' : 'Failed to load projects. Please try again.'}</p>
        </Card>
      ) : remoteProjects.length === 0 && !isAdding ? (
        <Card className="text-center py-20 flex flex-col items-center border-dashed bg-surface/30">
          <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4 text-muted-foreground/30 shadow-inner">
            <FolderOpen size={32} />
          </div>
          <h3 className="text-lg font-semibold mb-2">{t('proj_empty') || (isRtl ? 'هنوز پروژه‌ای نیست' : 'No Projects Yet')}</h3>
          <p className="text-muted-foreground max-w-sm mb-6 text-sm">{isRtl ? 'پروژه‌ای ایجاد کنید تا چت‌های مرتبط و عوامل را در یک مکان سازماندهی کنید.' : 'Create a project to organize related chats and specialized agents in one place.'}</p>
          <Button onClick={() => { setIsAdding(true); setActionError(''); setFormData({ name: '', description: '', status: 'active' }); }}>
            <Plus size={16} className="shrink-0" /> {t('create')}
          </Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {remoteProjects.map(p => (
            <Card
              key={p.id}
              className="group transition-all hover:border-primary/40 focus:border-primary focus:outline-none cursor-pointer flex flex-col hover:shadow-lg focus:shadow-lg hover:-translate-y-0.5 overflow-hidden"
              onClick={() => setSelectedProjectId(p.id)}
            >
              {editingId === p.id ? (
                <div className="space-y-4" onClick={e => e.stopPropagation()}>
                  <div>
                    <Label>{t('name')}</Label>
                    <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus />
                  </div>
                  <div>
                    <Label>{t('description')}</Label>
                    <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
                  <div>
                    <Label>{t('status')}</Label>
                    <select
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value as any})}
                    >
                      <option value="active">{t('active') || (isRtl ? 'فعال' : 'Active')}</option>
                      <option value="archived">{t('archived') || (isRtl ? 'بایگانی' : 'Archived')}</option>
                      <option value="completed">{t('completed') || (isRtl ? 'تکمیل شده' : 'Completed')}</option>
                    </select>
                  </div>
                  {actionError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={14}/> {actionError}</p>}
                  <div className="flex gap-2 pt-2">
                    <Button onClick={() => handleSaveProject(p.id)} disabled={updateProject.isPending}><Check size={16} className="shrink-0"/> {t('save')}</Button>
                    <Button variant="ghost" onClick={() => { setEditingId(null); setActionError(''); }} disabled={updateProject.isPending}><X size={16} className="shrink-0"/> {t('cancel')}</Button>
                  </div>
                </div>
              ) : deletingId === p.id ? (
                 <div className="flex flex-col h-full justify-center text-center space-y-4" onClick={e => e.stopPropagation()}>
                    <p className="text-red-400 font-medium">{isRtl ? `حذف "${p.name}"؟` : `Delete "${p.name}"?`}</p>
                    <p className="text-xs text-muted-foreground px-2">{isRtl ? 'این کار پروژه را برای همیشه پاک می‌کند. چت‌ها و عوامل باقی می‌مانند.' : 'This will permanently remove the project. Attached chats and agents will remain in your account.'}</p>
                    {actionError && <p className="text-xs text-red-400 flex justify-center items-center gap-1"><AlertCircle size={14}/> {actionError}</p>}
                    <div className="flex justify-center gap-2 mt-auto pt-4">
                       <Button variant="danger" size="sm" onClick={(e) => confirmDelete(p.id, e)} disabled={deleteProject.isPending}>{isRtl ? 'بله، حذف کن' : 'Yes, Delete'}</Button>
                       <Button variant="ghost" size="sm" onClick={() => { setDeletingId(null); setActionError(''); }} disabled={deleteProject.isPending}>{isRtl ? 'لغو' : 'Cancel'}</Button>
                    </div>
                 </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                      p.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                      p.status === 'completed' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      'bg-surface-hover text-muted-foreground border border-border'
                    }`}>
                      {t(p.status as any) || (p.status === 'active' ? (isRtl ? 'فعال' : 'Active') : p.status === 'archived' ? (isRtl ? 'بایگانی' : 'Archived') : (isRtl ? 'تکمیل شده' : 'Completed'))}
                    </span>
                     <div className="flex items-center gap-1 opacity-100 transition-opacity group-hover:opacity-100 group-focus:opacity-100 md:opacity-0">
                       <Button variant="ghost" size="sm" className="h-11 w-11 p-0 md:h-8 md:w-8" onClick={(e) => startEdit(p, e)} aria-label={isRtl ? 'ویرایش' : 'Edit'}><Edit2 size={14}/></Button>
                       <Button variant="ghost" size="sm" className="h-11 w-11 p-0 text-red-400 hover:bg-red-900/20 hover:text-red-300 md:h-8 md:w-8" onClick={(e) => { e.stopPropagation(); setDeletingId(p.id); setActionError(''); }} aria-label={isRtl ? 'حذف' : 'Delete'}><Trash2 size={14}/></Button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg truncate group-hover:text-primary group-focus:text-primary transition-colors">{p.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-2 flex-1">{p.description || (isRtl ? 'توضیحاتی ارائه نشده است.' : 'No description provided.')}</p>

                  <div className="mt-5 pt-4 border-t border-border/50 flex gap-4 text-xs font-medium text-muted-foreground group-hover:text-foreground group-focus:text-foreground transition-colors">
                    <span className="flex items-center gap-1.5 bg-background px-2 py-1 rounded-lg border border-border/50">
                      <MessageSquare size={14} className="text-primary/70"/> {(p.conversationIds || []).length}
                    </span>
                    <span className="flex items-center gap-1.5 bg-background px-2 py-1 rounded-lg border border-border/50">
                      <Bot size={14} className="text-primary/70"/> {(p.agentIds || []).length}
                    </span>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Subcomponents for Detail View
function AttachedChatRow({ chat, id, onRemove, onRename, disabled, isRtl }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(chat?.title || '');
  const [localError, setLocalError] = useState('');

  if (!chat) return (
    <div className="flex min-w-0 items-center justify-between gap-2 break-all rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground">
      {isRtl ? 'چت نامشخص' : 'Unknown Chat'} (ID: {id})
      <Button size="sm" variant="ghost" className="h-11 w-11 shrink-0 p-0 hover:bg-red-900/20 hover:text-red-400 md:h-7 md:w-7" onClick={() => onRemove(id)} disabled={disabled} aria-label={isRtl ? 'حذف' : 'Remove'}><X size={14}/></Button>
    </div>
  );

  const handleSaveRename = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setLocalError(isRtl ? 'عنوان الزامی است' : 'Title required');
      return;
    }
    setLocalError('');
    onRename(chat.id, trimmed, () => setIsEditing(false), () => setLocalError(isRtl ? 'خطا در ذخیره' : 'Save failed'));
  };

  return (
    <div className="group relative flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-background px-3 py-2 transition-colors hover:bg-surface focus-within:bg-surface sm:flex-row sm:items-center sm:justify-between">
      {isEditing ? (
        <div className="relative flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveRename()} autoFocus className="h-11 min-w-0 flex-1 px-3 py-1.5 text-sm sm:h-8" />
          <Button size="sm" className="h-11 px-3 sm:h-8" onClick={handleSaveRename} disabled={disabled || !title.trim()} aria-label={isRtl ? 'ذخیره' : 'Save'}><Check size={14}/></Button>
          <Button size="sm" variant="ghost" className="h-11 px-3 sm:h-8" onClick={() => { setIsEditing(false); setTitle(chat.title); setLocalError(''); }} disabled={disabled} aria-label={isRtl ? 'لغو' : 'Cancel'}><X size={14}/></Button>
          {localError && <span className="w-full text-[10px] text-red-400 sm:absolute sm:-bottom-5 sm:left-1 sm:w-auto sm:whitespace-nowrap">{localError}</span>}
        </div>
      ) : (
        <>
          <div className="min-h-11 min-w-0 flex-1 cursor-pointer py-1 sm:pr-4" onClick={() => setIsEditing(true)}>
            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{chat.title}</p>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
              <Calendar size={10} />
              <span>{new Date(chat.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 md:opacity-0">
            <Button size="sm" variant="ghost" className="h-11 w-11 p-0 sm:h-8 sm:w-8" onClick={() => setIsEditing(true)} disabled={disabled} aria-label={isRtl ? 'ویرایش' : 'Edit'}><Edit2 size={13}/></Button>
            <Link href={`/chat?agent=${chat.agentId}&conversation=${chat.id}`} className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary transition-all hover:bg-primary/20 sm:h-8">
              {isRtl ? 'باز کردن' : 'Open'} <ExternalLink size={13}/>
            </Link>
            <Button size="sm" variant="ghost" className="ml-1 h-11 w-11 p-0 text-red-400 hover:bg-red-900/20 sm:h-8 sm:w-8" onClick={() => onRemove(id)} disabled={disabled} aria-label={isRtl ? 'حذف' : 'Remove'}><X size={13}/></Button>
          </div>
        </>
      )}
    </div>
  );
}

function AttachedAgentRow({ agent, id, onRemove, disabled, isRtl }: any) {
  if (!agent) return (
    <div className="flex min-w-0 items-center justify-between gap-2 break-all rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground">
      {isRtl ? 'عامل نامشخص' : 'Unknown Agent'} (ID: {id})
      <Button size="sm" variant="ghost" className="h-11 w-11 shrink-0 p-0 hover:bg-red-900/20 hover:text-red-400 md:h-7 md:w-7" onClick={() => onRemove(id)} disabled={disabled} aria-label={isRtl ? 'حذف' : 'Remove'}><X size={14}/></Button>
    </div>
  );

  return (
    <div className="group flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-background px-3 py-2 transition-colors hover:bg-surface focus-within:bg-surface sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:pr-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Bot size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{agent.name}</p>
          <p className="text-[10px] text-muted-foreground truncate capitalize font-medium">{('category' in agent ? agent.category : (isRtl ? 'عامل سیستم' : 'System Agent'))}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 md:opacity-0">
        <Link href={`/${encodeURIComponent(agent.slug || agent.id)}`} className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary transition-all hover:bg-primary/20 sm:h-8">
          {isRtl ? 'پروفایل' : 'Profile'} <ExternalLink size={13}/>
        </Link>
        <Button size="sm" variant="ghost" className="ml-1 h-11 w-11 p-0 text-red-400 hover:bg-red-900/20 sm:h-8 sm:w-8" onClick={() => onRemove(id)} disabled={disabled} aria-label={isRtl ? 'حذف' : 'Remove'}><X size={13}/></Button>
      </div>
    </div>
  );
}
