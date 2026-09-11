import React from 'react'
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FileText,
  FilePlus,
  FileUp,
  FileEdit,
  Mic,
  Headphones,
  Layers,
  HelpCircle,
  Settings,
  User,
  Search,
  Plus,
  Upload,
  Link,
  MoreVertical,
  X,
  Check,
  Trash2,
  Copy,
  Sparkles,
  Download,
  ChevronRight,
  RotateCcw,
  Play,
  Pause,
  Globe,
  BookOpen,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info,
  GraduationCap,
  Trophy,
  Square,
  CircleDot,
  Quote,
  Code,
  List,
  Table,
  Zap,
  ShieldCheck,
  ArrowRight
} from 'lucide-react'

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number
  className?: string
}

// Re-exports mapped to existing naming conventions with Lucide under the hood
export const IconFolder: React.FC<IconProps> = ({ size = 16, ...props }) => <Folder size={size} {...props} />
export const IconFolderOpen: React.FC<IconProps> = ({ size = 16, ...props }) => <FolderOpen size={size} {...props} />
export const IconFolderPlus: React.FC<IconProps> = ({ size = 16, ...props }) => <FolderPlus size={size} {...props} />
export const IconFile: React.FC<IconProps> = ({ size = 16, ...props }) => <FileText size={size} {...props} />
export const IconFileText: React.FC<IconProps> = ({ size = 16, ...props }) => <FileText size={size} {...props} />
export const IconFilePlus: React.FC<IconProps> = ({ size = 16, ...props }) => <FilePlus size={size} {...props} />
export const IconFileUp: React.FC<IconProps> = ({ size = 16, ...props }) => <FileUp size={size} {...props} />
export const IconEdit: React.FC<IconProps> = ({ size = 16, ...props }) => <FileEdit size={size} {...props} />
export const IconMic: React.FC<IconProps> = ({ size = 16, ...props }) => <Mic size={size} {...props} />
export const IconHeadphones: React.FC<IconProps> = ({ size = 16, ...props }) => <Headphones size={size} {...props} />
export const IconCards: React.FC<IconProps> = ({ size = 16, ...props }) => <Layers size={size} {...props} />
export const IconHelpCircle: React.FC<IconProps> = ({ size = 16, ...props }) => <HelpCircle size={size} {...props} />
export const IconSettings: React.FC<IconProps> = ({ size = 16, ...props }) => <Settings size={size} {...props} />
export const IconUser: React.FC<IconProps> = ({ size = 16, ...props }) => <User size={size} {...props} />
export const IconSearch: React.FC<IconProps> = ({ size = 16, ...props }) => <Search size={size} {...props} />
export const IconPlus: React.FC<IconProps> = ({ size = 16, ...props }) => <Plus size={size} {...props} />
export const IconUpload: React.FC<IconProps> = ({ size = 16, ...props }) => <Upload size={size} {...props} />
export const IconLink: React.FC<IconProps> = ({ size = 16, ...props }) => <Link size={size} {...props} />
export const IconMore: React.FC<IconProps> = ({ size = 16, ...props }) => <MoreVertical size={size} {...props} />
export const IconX: React.FC<IconProps> = ({ size = 16, ...props }) => <X size={size} {...props} />
export const IconCheck: React.FC<IconProps> = ({ size = 16, ...props }) => <Check size={size} {...props} />
export const IconTrash: React.FC<IconProps> = ({ size = 16, ...props }) => <Trash2 size={size} {...props} />
export const IconCopy: React.FC<IconProps> = ({ size = 16, ...props }) => <Copy size={size} {...props} />
export const IconSparkles: React.FC<IconProps> = ({ size = 16, ...props }) => <Sparkles size={size} {...props} />
export const IconDownload: React.FC<IconProps> = ({ size = 16, ...props }) => <Download size={size} {...props} />
export const IconChevronRight: React.FC<IconProps> = ({ size = 14, ...props }) => <ChevronRight size={size} {...props} />
export const IconRotateCcw: React.FC<IconProps> = ({ size = 16, ...props }) => <RotateCcw size={size} {...props} />
export const IconPlay: React.FC<IconProps> = ({ size = 16, ...props }) => <Play size={size} {...props} />
export const IconPause: React.FC<IconProps> = ({ size = 16, ...props }) => <Pause size={size} {...props} />
export const IconGlobe: React.FC<IconProps> = ({ size = 16, ...props }) => <Globe size={size} {...props} />
export const IconBookOpen: React.FC<IconProps> = ({ size = 16, ...props }) => <BookOpen size={size} {...props} />
export const IconClock: React.FC<IconProps> = ({ size = 16, ...props }) => <Clock size={size} {...props} />
export const IconAlertTriangle: React.FC<IconProps> = ({ size = 16, ...props }) => <AlertTriangle size={size} {...props} />
export const IconCheckCircle: React.FC<IconProps> = ({ size = 16, ...props }) => <CheckCircle2 size={size} {...props} />
export const IconInfo: React.FC<IconProps> = ({ size = 16, ...props }) => <Info size={size} {...props} />
export const IconGraduationCap: React.FC<IconProps> = ({ size = 16, ...props }) => <GraduationCap size={size} {...props} />
export const IconTrophy: React.FC<IconProps> = ({ size = 16, ...props }) => <Trophy size={size} {...props} />
export const IconSquare: React.FC<IconProps> = ({ size = 16, ...props }) => <Square size={size} {...props} />
export const IconCircleDot: React.FC<IconProps> = ({ size = 16, ...props }) => <CircleDot size={size} {...props} />
export const IconQuote: React.FC<IconProps> = ({ size = 14, ...props }) => <Quote size={size} {...props} />
export const IconCode: React.FC<IconProps> = ({ size = 14, ...props }) => <Code size={size} {...props} />
export const IconList: React.FC<IconProps> = ({ size = 14, ...props }) => <List size={size} {...props} />
export const IconTable: React.FC<IconProps> = ({ size = 14, ...props }) => <Table size={size} {...props} />
export const IconZap: React.FC<IconProps> = ({ size = 16, ...props }) => <Zap size={size} {...props} />
export const IconShield: React.FC<IconProps> = ({ size = 16, ...props }) => <ShieldCheck size={size} {...props} />
export const IconArrowRight: React.FC<IconProps> = ({ size = 14, ...props }) => <ArrowRight size={size} {...props} />
