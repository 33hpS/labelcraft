import { useTheme } from '../context/ThemeContext'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Monitor } from 'lucide-react'
import { DropdownMenuSeparator } from '../components/ui/dropdown-menu'
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group'
import { Label } from '../components/ui/label'

export default function SettingsPage() {
  const { theme, setTheme, resolved } = useTheme()
  const { t } = useTranslation()

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground">
      <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-10 py-8">
        <h1 className="text-2xl font-bold mb-1">{t('settings.title', 'Настройки')}</h1>
        <p className="text-muted-foreground mb-6">{t('settings.subtitle', 'Личные параметры интерфейса')}</p>

        <section className="bg-card border border-border rounded-xl p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-1">{t('settings.appearance', 'Оформление')}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t('settings.themeDesc', 'Выберите тему интерфейса')}</p>
          <DropdownMenuSeparator />

          <RadioGroup className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3" value={theme} onValueChange={(v) => setTheme(v as any)}>
            <ThemeOption value="light" title={t('common.light')} description={t('settings.lightDesc', 'Светлые тона и контрастный текст')} icon={<Sun className="h-5 w-5" />} active={theme === 'light'} />
            <ThemeOption value="dark" title={t('common.dark')} description={t('settings.darkDesc', 'Тёмные фоны, сниженая яркость')} icon={<Moon className="h-5 w-5" />} active={theme === 'dark'} />
            <ThemeOption value="system" title={t('common.system')} description={t('settings.systemDesc', 'Следовать настройкам ОС')} icon={<Monitor className="h-5 w-5" />} active={theme === 'system'} note={t('settings.systemNote', { defaultValue: 'Сейчас: {{mode}}', mode: resolved === 'dark' ? t('common.dark') : t('common.light') })} />
          </RadioGroup>
        </section>
      </div>
    </div>
  )
}

function ThemeOption({ value, title, description, icon, active, note }: { value: 'light' | 'dark' | 'system', title: string, description: string, icon: React.ReactNode, active: boolean, note?: string }) {
  return (
    <div className={`relative rounded-lg border ${active ? 'border-primary' : 'border-border'} bg-card text-foreground p-4 transition-colors`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="flex-1">
          <Label className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor={`theme-${value}`}>{title}</Label>
          <p className="text-sm text-muted-foreground mt-1">{description}{note ? <span className="ml-1 opacity-80">— {note}</span> : null}</p>
        </div>
        <RadioGroupItem id={`theme-${value}`} value={value} />
      </div>
    </div>
  )
}
