import { useState } from 'react';
import { useLocalStore } from '../lib/store';
import { useTranslation } from '../lib/i18n';
import { PageHeader, Card, Button, Input, Label, Textarea } from '../components/ui-parts';
import { Plus, Trash2, Edit2, Check, X, Zap } from 'lucide-react';

export default function SkillsPage() {
  const { t, isRtl } = useTranslation();
  const { skills, addSkill, updateSkill, deleteSkill } = useLocalStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const [formData, setFormData] = useState({ nameEn: '', nameFa: '', instructionsEn: '', instructionsFa: '', enabled: true });

  const handleSave = (id?: string) => {
    if (!formData.nameEn || !formData.nameFa) return;
    
    if (id) {
      updateSkill(id, formData);
      setEditingId(null);
    } else {
      addSkill({
        id: Date.now().toString(),
        nameEn: formData.nameEn,
        nameFa: formData.nameFa,
        instructionsEn: formData.instructionsEn,
        instructionsFa: formData.instructionsFa,
        enabled: formData.enabled,
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
    }
    setFormData({ nameEn: '', nameFa: '', instructionsEn: '', instructionsFa: '', enabled: true });
  };

  const startEdit = (s: any) => {
    setFormData({ 
      nameEn: s.nameEn, nameFa: s.nameFa, 
      instructionsEn: s.instructionsEn, instructionsFa: s.instructionsFa, 
      enabled: s.enabled 
    });
    setEditingId(s.id);
    setIsAdding(false);
  };

  const SkillForm = ({ isNew }: { isNew: boolean }) => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>{t('skill_name_en')}</Label>
          <Input value={formData.nameEn} onChange={e => setFormData({...formData, nameEn: e.target.value})} dir="ltr" className="text-start" />
        </div>
        <div>
          <Label>{t('skill_name_fa')}</Label>
          <Input value={formData.nameFa} onChange={e => setFormData({...formData, nameFa: e.target.value})} dir="rtl" className="text-start" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>{t('skill_inst_en')}</Label>
          <Textarea value={formData.instructionsEn} onChange={e => setFormData({...formData, instructionsEn: e.target.value})} dir="ltr" rows={4} className="text-start" />
        </div>
        <div>
          <Label>{t('skill_inst_fa')}</Label>
          <Textarea value={formData.instructionsFa} onChange={e => setFormData({...formData, instructionsFa: e.target.value})} dir="rtl" rows={4} className="text-start" />
        </div>
      </div>
      <div className="flex items-center gap-3 py-2">
        <input 
          type="checkbox" 
          checked={formData.enabled}
          onChange={e => setFormData({...formData, enabled: e.target.checked})}
          className="w-4 h-4 rounded border-border bg-surface text-primary focus:ring-primary/50"
        />
        <label className="text-sm font-medium">{t('enabled')}</label>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => handleSave(isNew ? undefined : editingId!)}><Check size={16} className="shrink-0"/> {t('save')}</Button>
        <Button variant="ghost" onClick={() => { setIsAdding(false); setEditingId(null); }}><X size={16} className="shrink-0"/> {t('cancel')}</Button>
      </div>
    </div>
  );

  return (
    <div className="fade-up max-w-5xl mx-auto space-y-6">
      <PageHeader 
        title={t('skill_title')} 
        description={t('skill_desc')}
        action={
          !isAdding && <Button onClick={() => { setIsAdding(true); setFormData({ nameEn: '', nameFa: '', instructionsEn: '', instructionsFa: '', enabled: true }); }}>
            <Plus size={16} className="shrink-0" /> {t('add')}
          </Button>
        }
      />

      {isAdding && (
        <Card className="border-primary/50 border-2 bg-background/50">
          <SkillForm isNew={true} />
        </Card>
      )}

      {skills.length === 0 && !isAdding ? (
        <Card className="text-center py-16 flex flex-col items-center">
          <Zap size={48} className="text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">{t('skill_empty')}</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {skills.map(s => (
            <Card key={s.id} className="transition-all hover:border-primary/30">
              {editingId === s.id ? (
                <SkillForm isNew={false} />
              ) : (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${s.enabled ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-surface-hover text-muted-foreground border border-border'}`}>
                      <Zap size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg truncate">{isRtl ? s.nameFa : s.nameEn}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-1 truncate">
                        {isRtl ? s.instructionsFa : s.instructionsEn}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 sm:self-center self-end mt-2 sm:mt-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${isRtl ? 'ml-2' : 'mr-2'} ${s.enabled ? 'bg-green-500/20 text-green-400' : 'bg-surface-hover text-muted-foreground'}`}>
                      {s.enabled ? t('active') : t('disabled')}
                    </span>
                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0 shrink-0" onClick={() => startEdit(s)}><Edit2 size={14}/></Button>
                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20 shrink-0" onClick={() => deleteSkill(s.id)}><Trash2 size={14}/></Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}