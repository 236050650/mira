"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  Bookmark,
  Check,
  ChevronRight,
  CircleUserRound,
  Compass,
  Copy,
  Crown,
  Eye,
  EyeOff,
  Heart,
  Home,
  ImagePlus,
  LockKeyhole,
  Mail,
  MessageCircle,
  MessagesSquare,
  Mic,
  Moon,
  MoreHorizontal,
  Phone,
  Play,
  Plus,
  RotateCcw,
  Search,
  SendHorizontal,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  UserRound,
  Video,
  Volume2,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  personas,
  quickReplies,
  replyBank,
  seededChats,
  type Persona,
} from "./data";
import { useApiMode } from "./use-api-mode";
import {
  apiPersonaToPersona,
  findHeroPersona,
  findPersonaByKey,
  useMiraApp,
  type RecentChat,
} from "./use-mira-app";
import {
  ApiError,
  listMessages,
  listPersonas,
  regenerateMessage,
  stopGeneration,
  streamMessage,
  type ApiMessage,
} from "../lib/api";

type Route =
  | "auth"
  | "onboarding"
  | "home"
  | "discover"
  | "detail"
  | "chat"
  | "messages"
  | "profile"
  | "create";

type ChatMessage = {
  id: number | string;
  role: "assistant" | "user";
  text: string;
  time: string;
};

function personaQuickReplies(persona: Persona): string[] {
  if (persona.suggestedReplies?.length) return persona.suggestedReplies;
  if (persona.slug && quickReplies[persona.slug]) return quickReplies[persona.slug];
  return quickReplies[persona.id] || [];
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function apiMessagesToChat(messages: ApiMessage[]): ChatMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.id,
      role: message.role as "assistant" | "user",
      text: message.content,
      time: formatMessageTime(message.createdAt),
    }));
}

const categories = ["为你推荐", "中国历史", "思想家", "军事家", "动漫角色", "原创角色"];
const routeNames: Route[] = [
  "auth",
  "onboarding",
  "home",
  "discover",
  "detail",
  "chat",
  "messages",
  "profile",
  "create",
];

function artStyle(persona: Persona): CSSProperties {
  if (persona.image) {
    return {
      backgroundColor: persona.artTone || "#e9e5dc",
      backgroundImage: `url('${persona.image}')`,
      backgroundRepeat: "no-repeat",
      backgroundSize: "contain",
      backgroundPosition: "center bottom",
      "--accent": persona.accent,
    } as CSSProperties;
  }
  const atlas = {
    original: "/persona-atlas-v2.png",
    "history-war": "/history-war-atlas.png",
    "history-thought": "/history-thought-atlas.png",
  }[persona.atlas || "original"];
  return {
    backgroundImage: `url('${atlas}')`,
    backgroundSize: "400% 100%",
    backgroundPosition: `${persona.panel * 33.333}% center`,
    "--accent": persona.accent,
  } as CSSProperties;
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  const nextLabel = theme === "light" ? "切换到深色模式" : "切换到浅色模式";
  return (
    <button className="theme-toggle" onClick={onToggle} aria-label={nextLabel} title={nextLabel}>
      {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
      <span>{theme === "light" ? "深色" : "浅色"}</span>
    </button>
  );
}

function ApiModeToggle({
  mode,
  onToggle,
  apiUrl,
}: {
  mode: "demo" | "api";
  onToggle: () => void;
  apiUrl: string;
}) {
  const label = mode === "api" ? "API 数据" : "演示数据";
  const nextLabel = mode === "api" ? "演示数据" : "API 数据";
  return (
    <button
      className="api-mode-toggle"
      onClick={onToggle}
      aria-label={`当前数据源：${label}，点击切换到${nextLabel}`}
      title={`当前：${label} · ${apiUrl}`}
    >
      <Zap size={14} />
      <span>{label}</span>
    </button>
  );
}

function GlobalToast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="toast global-toast">
      <Check size={16} />
      {message}
    </div>
  );
}

function initialMessages(persona: Persona): ChatMessage[] {
  return [
    {
      id: 1,
      role: "assistant",
      text: persona.hook,
      time: "19:42",
    },
  ];
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="MIRA 镜语">
      <span className="brand-mark">
        <Sparkles size={compact ? 17 : 20} />
      </span>
      {!compact && (
        <span>
          <strong>MIRA</strong>
          <small>镜语</small>
        </span>
      )}
    </div>
  );
}

function Button({
  children,
  className = "",
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      className={`button ${className}`}
      onClick={onClick}
      type={type}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Portrait({
  persona,
  className = "",
  children,
}: {
  persona: Persona;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`portrait ${className}`} style={artStyle(persona)}>
      {children}
    </div>
  );
}

function PersonaCard({
  persona,
  onOpen,
  favorite,
  onFavorite,
}: {
  persona: Persona;
  onOpen: () => void;
  favorite: boolean;
  onFavorite: () => void;
}) {
  return (
    <article
      className="persona-card"
      style={{ "--accent": persona.accent } as CSSProperties}
    >
      <button className="card-main" onClick={onOpen} aria-label={`查看${persona.name}`}>
        <Portrait persona={persona} className="card-art">
          <span className="card-gradient" />
          <span className={`presence ${persona.online ? "online" : ""}`}>
            {persona.online ? "在线" : "稍后回来"}
          </span>
          <span className="card-count">
            <MessageCircle size={13} />
            {persona.conversations}
          </span>
        </Portrait>
        <span className="card-copy">
          <span className="card-title-row">
            <strong>{persona.name}</strong>
            {persona.id === "ling" && <BadgeCheck size={16} />}
          </span>
          <span className="card-subtitle">{persona.subtitle}</span>
          <span className="tag-row">
            {persona.tags.slice(0, 3).map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </span>
        </span>
      </button>
      <button
        className={`heart-button ${favorite ? "active" : ""}`}
        onClick={onFavorite}
        aria-label={favorite ? `取消收藏${persona.name}` : `收藏${persona.name}`}
      >
        <Heart size={18} fill={favorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}

function AuthView({
  onLogin,
  loading,
  isApiMode,
  onTryDemo,
  personaPreview,
}: {
  onLogin: (params: {
    isSignup: boolean;
    email: string;
    password: string;
    nickname?: string;
    skipAuth?: boolean;
  }) => void | Promise<void>;
  loading?: boolean;
  isApiMode?: boolean;
  onTryDemo?: () => void;
  personaPreview?: Persona[];
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const previewPersonas = personaPreview ?? personas;

  useEffect(() => {
    setEmail("");
    setPassword("");
  }, [mode]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void onLogin({
      isSignup: mode === "signup",
      email,
      password,
      nickname: mode === "signup" ? nickname : undefined,
    });
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-art" />
        <div className="auth-visual-overlay" />
        <div className="auth-brand">
          <Logo />
        </div>
        <div className="auth-quote">
          <span className="eyebrow">不止是回答</span>
          <h1>与万千灵魂<br />真正相遇</h1>
          <p>原创角色、思想人格与长期记忆，让每一段对话都有自己的故事。</p>
          <div className="auth-proof">
            <div className="avatar-stack">
              {previewPersonas.slice(0, 4).map((persona) => (
                <Portrait key={persona.id} persona={persona} />
              ))}
            </div>
            <span>已有 128,000 位探索者加入</span>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="mobile-auth-logo">
          <Logo />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">WELCOME TO MIRA</span>
          <h2>{mode === "login" ? "欢迎回来" : "创建你的旅程"}</h2>
          <p className="muted">
            {mode === "login"
              ? "继续上一次没有说完的故事。"
              : "只需一分钟，遇见与你同频的角色。"}
          </p>

          <div className="auth-tabs" role="tablist">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
              role="tab"
            >
              登录
            </button>
            <button
              className={mode === "signup" ? "active" : ""}
              onClick={() => setMode("signup")}
              role="tab"
            >
              注册
            </button>
          </div>

          <form onSubmit={submit} className="auth-form">
            {mode === "signup" && (
              <label>
                <span>昵称</span>
                <div className="input-shell">
                  <UserRound size={18} />
                  <input
                    placeholder="希望角色怎么称呼你"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    required
                  />
                </div>
              </label>
            )}
            <label>
              <span>邮箱</span>
              <div className="input-shell">
                <Mail size={18} />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </label>
            <label>
              <span>密码</span>
              <div className="input-shell">
                <LockKeyhole size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="至少 8 位，含字母和数字"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label="显示或隐藏密码"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <div className="form-between">
              <label className="checkbox-label">
                <input type="checkbox" defaultChecked />
                <span>{mode === "login" ? "记住我" : "同意服务条款与隐私政策"}</span>
              </label>
              {mode === "login" && <button type="button">忘记密码？</button>}
            </div>
            <Button className="primary wide" type="submit" disabled={loading}>
              {mode === "login" ? "进入 MIRA" : "创建账户"}
              <ArrowRight size={18} />
            </Button>
          </form>
          <div className="divider"><span>或</span></div>
          <Button
            className="secondary wide"
            onClick={() => (isApiMode && onTryDemo ? onTryDemo() : void onLogin({ isSignup: false, email: "", password: "", skipAuth: true }))}
            disabled={loading}
          >
            <Sparkles size={18} />
            直接体验 Demo
          </Button>
          <p className="auth-note">
            <ShieldCheck size={15} />
            {isApiMode
              ? "API 模式没有预置账号；首次使用请先注册，也可直接体验 Demo"
              : "这是交互原型，账户与对话均为本地模拟数据"}
          </p>
        </div>
      </section>
    </main>
  );
}

function OnboardingView({
  onDone,
  onComplete,
}: {
  onDone: () => void;
  onComplete?: (interests: string[], skipped: boolean) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState(["中国历史", "思想对谈"]);
  const choices = ["中国历史", "军事谋略", "思想对谈", "动漫伙伴", "原创角色", "剧情冒险"];

  function finish(skipped = false) {
    void onComplete?.(selected, skipped);
    onDone();
  }

  return (
    <main className="onboarding">
      <div className="onboarding-top">
        <Logo />
        <span>01 / 02</span>
      </div>
      <section className="onboarding-card">
        <span className="eyebrow">打造你的专属世界</span>
        <h1>你想遇见怎样的灵魂？</h1>
        <p>选择感兴趣的方向，我们会据此生成首批推荐。以后随时可以调整。</p>
        <div className="choice-grid">
          {choices.map((choice, index) => {
            const active = selected.includes(choice);
            return (
              <button
                key={choice}
                className={active ? "active" : ""}
                onClick={() =>
                  setSelected((items) =>
                    items.includes(choice)
                      ? items.filter((item) => item !== choice)
                      : [...items, choice],
                  )
                }
              >
                <span className={`choice-icon choice-${index + 1}`}>
                  {index % 2 === 0 ? <Sparkles size={21} /> : <MessageCircle size={21} />}
                </span>
                <strong>{choice}</strong>
                <span className="choice-check">{active && <Check size={15} />}</span>
              </button>
            );
          })}
        </div>
        <Button className="primary wide" onClick={() => finish(false)} disabled={!selected.length}>
          生成我的角色推荐
          <ArrowRight size={18} />
        </Button>
        <button className="skip" onClick={() => finish(true)}>暂时跳过</button>
      </section>
    </main>
  );
}

function Sidebar({
  route,
  onRoute,
  onCreate,
  displayName,
  unreadTotal,
}: {
  route: Route;
  onRoute: (route: Route) => void;
  onCreate: () => void;
  displayName?: string;
  unreadTotal?: number;
}) {
  const items = [
    { id: "home" as Route, label: "首页", icon: Home },
    { id: "discover" as Route, label: "发现", icon: Compass },
    { id: "messages" as Route, label: "消息", icon: MessagesSquare, badge: unreadTotal },
    { id: "profile" as Route, label: "我的", icon: CircleUserRound },
  ];
  return (
    <aside className="sidebar">
      <Logo />
      <nav>
        {items.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            className={route === id ? "active" : ""}
            onClick={() => onRoute(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
            {badge ? <em>{badge}</em> : null}
          </button>
        ))}
      </nav>
      <button className="create-nav" onClick={onCreate}>
        <Plus size={20} />
        <span>创建角色</span>
      </button>
      <div className="sidebar-plan">
        <Crown size={18} />
        <div><strong>MIRA Plus</strong><small>解锁长期记忆</small></div>
        <ChevronRight size={16} />
      </div>
      <button className="sidebar-user" onClick={() => onRoute("profile")}>
        <span>{displayName?.slice(0, 1) ?? "林"}</span>
        <div><strong>{displayName ?? "林墨"}</strong><small>Lv. 8 探索者</small></div>
        <MoreHorizontal size={18} />
      </button>
    </aside>
  );
}

function MobileNav({
  route,
  onRoute,
  unreadTotal,
}: {
  route: Route;
  onRoute: (route: Route) => void;
  unreadTotal?: number;
}) {
  const items = [
    { id: "home" as Route, label: "首页", icon: Home },
    { id: "discover" as Route, label: "发现", icon: Compass },
    { id: "messages" as Route, label: "消息", icon: MessagesSquare },
    { id: "profile" as Route, label: "我的", icon: CircleUserRound },
  ];
  return (
    <nav className="mobile-nav">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={route === id ? "active" : ""}
          onClick={() => onRoute(id)}
        >
          <Icon size={20} />
          <span>{label}</span>
          {id === "messages" && unreadTotal ? <em>{unreadTotal}</em> : null}
        </button>
      ))}
    </nav>
  );
}

function PageHeader({
  title,
  subtitle,
  onSearch,
  displayName,
}: {
  title: string;
  subtitle?: string;
  onSearch?: () => void;
  displayName?: string;
}) {
  return (
    <header className="page-header">
      <div className="mobile-logo"><Logo /></div>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="header-actions">
        {onSearch && (
          <button onClick={onSearch} aria-label="搜索">
            <Search size={20} />
          </button>
        )}
        <button aria-label="通知" className="notification">
          <Bell size={20} />
          <span />
        </button>
        <span className="mini-avatar">{displayName?.slice(0, 1) ?? "林"}</span>
      </div>
    </header>
  );
}

function HomeView({
  personaList,
  favorites,
  onFavorite,
  onPersona,
  onChat,
  onRoute,
  displayName,
  recentChats,
}: {
  personaList: Persona[];
  favorites: string[];
  onFavorite: (id: string) => void;
  onPersona: (persona: Persona) => void;
  onChat: (persona: Persona, conversationId?: string) => void;
  onRoute: (route: Route) => void;
  displayName?: string;
  recentChats?: RecentChat[];
}) {
  const heroPersona = findHeroPersona(personaList);
  const historyPicks = ["huo-qubing", "confucius", "hanxin", "wang-yangming"]
    .map((id) => findPersonaByKey(personaList, id))
    .filter(Boolean) as Persona[];
  const animePicks = personaList.filter((persona) => persona.category === "动漫角色");
  const continueChats: RecentChat[] =
    recentChats ??
    seededChats.slice(0, 3).flatMap((chat) => {
      const persona = findPersonaByKey(personaList, chat.id);
      if (!persona) return [];
      return [{ persona, preview: chat.preview, time: chat.time, unread: chat.unread }];
    });
  return (
    <>
      <PageHeader
        title={`晚上好，${displayName ?? "林墨"}`}
        subtitle="今天想和谁聊聊？"
        onSearch={() => onRoute("discover")}
        displayName={displayName}
      />
      <div className="page-content home-content">
        <section className="hero-card history-hero" style={{ "--accent": heroPersona.accent } as CSSProperties}>
          <Portrait persona={heroPersona} className="hero-art" />
          <div className="hero-overlay" />
          <div className="hero-copy">
            <span className="hero-label"><Zap size={14} /> 今日人物</span>
            <h2>少年意气<br />越过千年大漠</h2>
            <p>与霍去病对谈选择、速度与一个年轻人如何看见战场全局。</p>
            <div className="hero-actions">
              <Button className="light" onClick={() => onChat(heroPersona)}>
                <Play size={17} fill="currentColor" />开始对谈
              </Button>
              <button onClick={() => onPersona(heroPersona)}>查看人物</button>
            </div>
          </div>
          <div className="hero-pages"><span className="active" /><span /><span /></div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div><h2>继续聊天</h2><p>接着上次没有说完的话</p></div>
            <button onClick={() => onRoute("messages")}>全部 <ChevronRight size={16} /></button>
          </div>
          <div className="continue-row">
            {continueChats.map((chat) => (
              <button
                key={chat.persona.id + (chat.conversationId ?? chat.preview)}
                className="continue-card"
                onClick={() => onChat(chat.persona, chat.conversationId)}
              >
                <Portrait persona={chat.persona} className="continue-art" />
                <span className="continue-copy">
                  <strong>{chat.persona.name}</strong>
                  <span>{chat.preview}</span>
                </span>
                <span className="continue-meta">
                  <small>{chat.time}</small>
                  {!!chat.unread && <em>{chat.unread}</em>}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div><h2>千年中国</h2><p>与思想家、军事家讨论今天的问题</p></div>
            <button onClick={() => onRoute("discover")}>发现更多 <ChevronRight size={16} /></button>
          </div>
          <div className="persona-grid">
            {historyPicks.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                onOpen={() => onPersona(persona)}
                favorite={favorites.includes(persona.id)}
                onFavorite={() => onFavorite(persona.id)}
              />
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div><h2>动漫伙伴</h2><p>熟悉的人物，也能开始新的日常与冒险</p></div>
            <button onClick={() => onRoute("discover")}>查看全部 <ChevronRight size={16} /></button>
          </div>
          <div className="persona-grid">
            {animePicks.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                onOpen={() => onPersona(persona)}
                favorite={favorites.includes(persona.id)}
                onFavorite={() => onFavorite(persona.id)}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function DiscoverView({
  personaList,
  favorites,
  onFavorite,
  onPersona,
  isApiMode,
  onLoadCategory,
  onError,
}: {
  personaList: Persona[];
  favorites: string[];
  onFavorite: (id: string) => void;
  onPersona: (persona: Persona) => void;
  isApiMode?: boolean;
  onLoadCategory?: (category: string, query: string) => Promise<Persona[]>;
  onError?: (message: string) => void;
}) {
  const [category, setCategory] = useState("为你推荐");
  const [search, setSearch] = useState("");
  const [remoteList, setRemoteList] = useState<Persona[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isApiMode || !onLoadCategory) {
      setRemoteList(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void onLoadCategory(category, search)
        .then((items) => {
          if (!cancelled) setRemoteList(items);
        })
        .catch((error) => {
          if (!cancelled) {
            onError?.(error instanceof ApiError ? error.message : "加载角色失败");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, search ? 280 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [category, isApiMode, onError, onLoadCategory, search]);

  const filtered = useMemo(() => {
    const source = isApiMode && remoteList ? remoteList : personaList;
    if (isApiMode && remoteList) return source;
    return source.filter((persona) => {
      const matchCategory =
        category === "为你推荐" ||
        persona.category === category ||
        (category === "中国历史" &&
          ["思想家", "军事家", "历史人物"].includes(persona.category));
      const matchSearch = `${persona.name}${persona.subtitle}${persona.tags.join("")}`
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [category, isApiMode, personaList, remoteList, search]);

  return (
    <>
      <PageHeader title="发现角色" subtitle="每一次相遇，都可能成为新的故事" />
      <div className="page-content discover-content">
        <div className="search-row">
          <label className="search-box">
            <Search size={19} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索角色、性格或故事..."
            />
            {search && <button onClick={() => setSearch("")}><X size={17} /></button>}
          </label>
          <button className="filter-button"><SlidersHorizontal size={19} /><span>筛选</span></button>
        </div>
        <div className="category-tabs">
          {categories.map((item) => (
            <button
              key={item}
              className={item === category ? "active" : ""}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="discover-banner">
          <div>
            <span><WandSparkles size={15} /> 创作者计划</span>
            <h2>你想象的灵魂，也可以在这里醒来</h2>
            <p>用几句话描述性格与世界观，MIRA 会帮你完成角色设定。</p>
          </div>
          <Button className="secondary">开始创造 <ArrowRight size={17} /></Button>
        </div>
        <div className="result-line">
          <span>{loading ? "加载中…" : `${filtered.length} 个角色`}</span>
          <button>综合排序 <ChevronRight size={15} /></button>
        </div>
        <div className="persona-grid">
          {filtered.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              onOpen={() => onPersona(persona)}
              favorite={favorites.includes(persona.id)}
              onFavorite={() => onFavorite(persona.id)}
            />
          ))}
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <Search size={30} /><h3>没有找到相符的角色</h3><p>试试更简短的关键词。</p>
          </div>
        )}
      </div>
    </>
  );
}

function DetailView({
  persona,
  favorite,
  onFavorite,
  onBack,
  onChat,
}: {
  persona: Persona;
  favorite: boolean;
  onFavorite: () => void;
  onBack: () => void;
  onChat: () => void;
}) {
  return (
    <div className="detail-page" style={{ "--accent": persona.accent } as CSSProperties}>
      <section className="detail-hero">
        <Portrait persona={persona} className="detail-art" />
        <div className="detail-overlay" />
        <div className="floating-topbar">
          <button onClick={onBack} aria-label="返回"><ArrowLeft size={21} /></button>
          <div>
            <button onClick={onFavorite} aria-label="收藏">
              <Heart size={20} fill={favorite ? "currentColor" : "none"} />
            </button>
            <button aria-label="更多"><MoreHorizontal size={21} /></button>
          </div>
        </div>
        <div className="detail-title">
          <span className="detail-category">{persona.category}</span>
          <h1>{persona.name}{persona.id === "ling" && <BadgeCheck size={23} />}</h1>
          <p>{persona.subtitle}</p>
          <div className="tag-row">
            {persona.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          </div>
        </div>
      </section>
      <section className="detail-body">
        <div className="detail-primary">
          <div className="detail-stats">
            <div><strong>{persona.conversations}</strong><span>次对话</span></div>
            <div><strong>96%</strong><span>角色一致性</span></div>
            <div><strong>{persona.relation}</strong><span>初始关系</span></div>
          </div>
          <div className="detail-section">
            <div className="section-heading"><div><h2>关于 {persona.name}</h2></div></div>
            <p className="detail-intro">{persona.intro}</p>
          </div>
          <div className="detail-section">
            <div className="section-heading"><div><h2>你们可以这样开始</h2></div></div>
            <div className="starter-list">
              {personaQuickReplies(persona).map((reply) => (
                <button key={reply} onClick={onChat}>
                  <MessageCircle size={17} />
                  <span>{reply}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          </div>
          <div className="detail-section detail-safety">
            <ShieldCheck size={19} />
            <div><strong>AI 生成角色</strong><p>对话内容由 AI 生成，可能包含虚构信息。你可以随时编辑记忆与重置关系。</p></div>
          </div>
        </div>
        <aside className="detail-side">
          <div className="voice-card">
            <button><Play size={18} fill="currentColor" /></button>
            <div><strong>试听角色声音</strong><span>{persona.voice} · 12 秒</span></div>
            <Volume2 size={18} />
          </div>
          <Button className="primary wide" onClick={onChat}>
            <MessageCircle size={18} />开始对话
          </Button>
          <p><Sparkles size={14} />支持长期记忆与剧情分支</p>
        </aside>
      </section>
    </div>
  );
}

function ChatView({
  persona,
  onBack,
  onDetail,
  isApiMode,
  conversationId,
  onError,
}: {
  persona: Persona;
  onBack: () => void;
  onDetail: () => void;
  isApiMode?: boolean;
  conversationId?: string | null;
  onError?: (message: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages(persona));
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const [showMemory, setShowMemory] = useState(false);
  const [toast, setToast] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const replies = personaQuickReplies(persona);
  const hasActiveAssistantMessage = Boolean(
    typing &&
      activeAssistantId &&
      messages.some(
        (message) =>
          message.role === "assistant" && String(message.id) === activeAssistantId,
      ),
  );

  useEffect(() => {
    setShowMemory(window.matchMedia("(min-width: 1101px)").matches);
  }, [persona.id]);

  useEffect(() => {
    if (!isApiMode || !conversationId) {
      setMessages(initialMessages(persona));
      setText("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    void listMessages(conversationId)
      .then((items) => {
        if (cancelled) return;
        const mapped = apiMessagesToChat(items);
        setMessages(mapped.length ? mapped : initialMessages(persona));
      })
      .catch((error) => {
        if (!cancelled) {
          onError?.(error instanceof ApiError ? error.message : "加载消息失败");
          setMessages(initialMessages(persona));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    setText("");
    return () => {
      cancelled = true;
    };
  }, [conversationId, isApiMode, onError, persona]);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [messages, typing]);

  async function sendApi(content: string) {
    if (!conversationId) return;
    streamAbortRef.current?.abort();
    const abort = new AbortController();
    streamAbortRef.current = abort;

    const userId = `user-${crypto.randomUUID()}`;
    setMessages((items) => [
      ...items,
      { id: userId, role: "user", text: content, time: "现在" },
    ]);
    setTyping(true);
    setGenerationId(null);

    const localAssistantId = `assistant-${crypto.randomUUID()}`;
    const assistantIdRef = { current: localAssistantId };
    setActiveAssistantId(localAssistantId);
    setMessages((items) => [
      ...items,
      { id: localAssistantId, role: "assistant", text: "", time: "现在" },
    ]);

    try {
      await streamMessage(
        conversationId,
        content,
        {
          onAccepted: (data) => {
            assistantIdRef.current = data.assistantMessageId;
            setActiveAssistantId(data.assistantMessageId);
            setGenerationId(data.generationId);
            setMessages((items) =>
              items.map((message) =>
                message.id === localAssistantId ||
                message.id === assistantIdRef.current
                  ? { ...message, id: data.assistantMessageId }
                  : message,
              ),
            );
          },
          onDelta: (data) => {
            setMessages((items) =>
              items.map((message) =>
                message.id === data.assistantMessageId ||
                message.id === assistantIdRef.current ||
                message.id === localAssistantId
                  ? { ...message, id: data.assistantMessageId, text: message.text + data.delta }
                  : message,
              ),
            );
          },
          onCompleted: () => {
            setTyping(false);
            setGenerationId(null);
            setActiveAssistantId(null);
          },
          onFailed: (data) => {
            setTyping(false);
            setGenerationId(null);
            setActiveAssistantId(null);
            if (data.code === "GENERATION_INTERRUPTED") {
              showToast("已停止生成");
              return;
            }
            onError?.(data.message || "消息生成失败");
          },
        },
        { signal: abort.signal },
      );
      setTyping(false);
      setGenerationId(null);
      setActiveAssistantId(null);
    } catch (error) {
      setTyping(false);
      setGenerationId(null);
      setActiveAssistantId(null);
      if (abort.signal.aborted) {
        showToast("已停止生成");
        return;
      }
      onError?.(error instanceof ApiError ? error.message : "发送失败，请稍后重试");
      setMessages((items) =>
        items.filter(
          (message) =>
            (message.id !== localAssistantId && message.id !== assistantIdRef.current) ||
            Boolean(message.text),
        ),
      );
    }
  }

  async function handleStop() {
    if (!conversationId || !generationId) {
      streamAbortRef.current?.abort();
      setTyping(false);
      return;
    }
    try {
      await stopGeneration(conversationId, generationId);
      streamAbortRef.current?.abort();
      setTyping(false);
      setGenerationId(null);
      showToast("已停止生成");
    } catch (error) {
      streamAbortRef.current?.abort();
      setTyping(false);
      onError?.(error instanceof ApiError ? error.message : "停止失败");
    }
  }

  async function handleRegenerate(messageId: string) {
    if (!isApiMode || !conversationId || typing) {
      showToast(isApiMode ? "请稍后再试" : "已重新生成");
      return;
    }
    streamAbortRef.current?.abort();
    const abort = new AbortController();
    streamAbortRef.current = abort;
    setTyping(true);
    setActiveAssistantId(messageId);
    setMessages((items) =>
      items.map((message) => (message.id === messageId ? { ...message, text: "" } : message)),
    );

    try {
      await regenerateMessage(
        conversationId,
        String(messageId),
        {
          onAccepted: (data) => {
            setGenerationId(data.generationId);
            setActiveAssistantId(data.assistantMessageId);
            setMessages((items) =>
              items.map((message) =>
                String(message.id) === String(messageId)
                  ? { ...message, id: data.assistantMessageId }
                  : message,
              ),
            );
          },
          onDelta: (data) => {
            setMessages((items) =>
              items.map((message) =>
                message.id === messageId || message.id === data.assistantMessageId
                  ? { ...message, id: data.assistantMessageId, text: message.text + data.delta }
                  : message,
              ),
            );
          },
          onCompleted: () => {
            setTyping(false);
            setGenerationId(null);
            setActiveAssistantId(null);
            showToast("已重新生成");
          },
          onFailed: (data) => {
            setTyping(false);
            setGenerationId(null);
            setActiveAssistantId(null);
            onError?.(data.message || "重新生成失败");
          },
        },
        { signal: abort.signal },
      );
    } catch (error) {
      setTyping(false);
      setGenerationId(null);
      setActiveAssistantId(null);
      if (!abort.signal.aborted) {
        onError?.(error instanceof ApiError ? error.message : "重新生成失败");
      }
    }
  }

  async function handleCopy(textToCopy: string) {
    try {
      await navigator.clipboard.writeText(textToCopy);
      showToast("已复制");
    } catch {
      showToast("复制失败");
    }
  }

  function send(content = text) {
    const trimmed = content.trim();
    if (!trimmed || typing || loading) return;

    if (isApiMode && conversationId) {
      setText("");
      void sendApi(trimmed);
      return;
    }

    setMessages((items) => [
      ...items,
      { id: Date.now(), role: "user", text: trimmed, time: "现在" },
    ]);
    setText("");
    setTyping(true);
    window.setTimeout(() => {
      const slug = persona.slug ?? persona.id;
      const bank = replyBank[slug] || replyBank[persona.id] || ["我在听。愿意再多告诉我一点吗？"];
      const answer = bank[Math.floor(Math.random() * bank.length)];
      setMessages((items) => [
        ...items,
        { id: Date.now() + 1, role: "assistant", text: answer, time: "现在" },
      ]);
      setTyping(false);
    }, 950);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1600);
  }

  return (
    <div className="chat-page" style={{ "--accent": persona.accent } as CSSProperties}>
      <div className="chat-background" style={artStyle(persona)} />
      <section className="chat-main">
        <header className="chat-header">
          <button onClick={onBack} aria-label="返回"><ArrowLeft size={21} /></button>
          <button className="chat-persona" onClick={onDetail}>
            <Portrait persona={persona} />
            <span><strong>{persona.name}</strong><small><i />在线 · 正在倾听</small></span>
          </button>
          <div className="chat-tools">
            <button aria-label="语音通话"><Phone size={19} /></button>
            <button aria-label="视频通话"><Video size={19} /></button>
            <button aria-label="更多"><MoreHorizontal size={20} /></button>
          </div>
        </header>
        <div className="chat-thread" ref={threadRef}>
          <div className="chat-date"><span>今天 19:42</span></div>
          <div className="story-context">
            <Sparkles size={16} />
            <p><strong>场景已开始</strong>{persona.intro.slice(0, 62)}…</p>
          </div>
          {loading && (
            <div className="chat-date"><span>正在同步历史消息…</span></div>
          )}
          {messages.map((message) => {
            const isActiveAssistant = Boolean(
              typing &&
                message.role === "assistant" &&
                activeAssistantId &&
                String(message.id) === activeAssistantId,
            );

            return (
              <div key={message.id} className={`message-row ${message.role}`}>
                {message.role === "assistant" && <Portrait persona={persona} />}
                <div className="message-wrap">
                  {isActiveAssistant && !message.text ? (
                    <div className="typing-bubble"><span /><span /><span /></div>
                  ) : (
                    <div className="message-bubble">{message.text}</div>
                  )}
                  {isActiveAssistant ? (
                    <div className="generation-meta">
                      <small className="typing-label">
                        {message.text
                          ? `${persona.name} 正在回复…`
                          : `${persona.name} 正在斟酌怎么回答…`}
                      </small>
                      {isApiMode && (
                        <button type="button" className="stop-generation" onClick={() => void handleStop()}>
                          停止生成
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="message-meta">
                      <span>{message.time}</span>
                      {message.role === "assistant" && (
                        <span className="message-actions">
                          <button
                            type="button"
                            aria-label="复制"
                            onClick={() => void handleCopy(message.text)}
                          >
                            <Copy size={14} />
                          </button>
                          <button type="button" aria-label="收藏" onClick={() => showToast("已收藏到片段")}>
                            <Bookmark size={14} />
                          </button>
                          <button
                            type="button"
                            aria-label="重新生成"
                            onClick={() => void handleRegenerate(String(message.id))}
                          >
                            <RotateCcw size={14} />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {typing && !hasActiveAssistantMessage && (
            <div className="message-row assistant">
              <Portrait persona={persona} />
              <div className="message-wrap">
                <div className="typing-bubble"><span /><span /><span /></div>
                <small className="typing-label">{persona.name} 正在斟酌怎么回答…</small>
                {isApiMode && (
                  <button type="button" className="stop-generation" onClick={() => void handleStop()}>
                    停止生成
                  </button>
                )}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="composer-area">
          <div className="quick-replies">
            {replies.map((reply) => (
              <button key={reply} onClick={() => send(reply)}>{reply}</button>
            ))}
          </div>
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <button type="button" aria-label="添加内容"><Plus size={20} /></button>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`对 ${persona.name} 说点什么…`}
              rows={1}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
            />
            <button type="button" aria-label="发送图片"><ImagePlus size={19} /></button>
            <button type="button" aria-label="语音输入"><Mic size={19} /></button>
            <button className="send-button" type="submit" disabled={!text.trim() || typing || loading}>
              <SendHorizontal size={18} />
            </button>
          </form>
          <p>AI 角色可能会犯错，请勿分享敏感个人信息</p>
        </div>
      </section>
      <aside className={`memory-panel ${showMemory ? "open" : ""}`}>
        <button className="memory-close" onClick={() => setShowMemory(false)}><X size={18} /></button>
        <Portrait persona={persona} className="memory-art" />
        <h2>你与 {persona.name}</h2>
        <span className="relation-pill"><Star size={14} fill="currentColor" />{persona.relation}</span>
        <div className="relation-progress"><span style={{ width: "62%" }} /></div>
        <small>再进行 2 次深入对话，关系将发生变化</small>
        <div className="memory-section">
          <div><h3>共同记忆</h3><button>管理</button></div>
          <ul>
            <li><span>雨夜</span><p>你说自己喜欢下雨时待在家里</p></li>
            <li><span>习惯</span><p>你通常会在晚上十点以后上线</p></li>
            <li><span>心情</span><p>你最近正为一个新计划做准备</p></li>
          </ul>
        </div>
        <div className="memory-section">
          <div><h3>本次场景</h3></div>
          <p className="scene-note">{persona.hook}</p>
        </div>
        <Button className="ghost wide"><RotateCcw size={16} />重置本段剧情</Button>
      </aside>
      {!showMemory && (
        <button className="memory-open" onClick={() => setShowMemory(true)}>
          <Sparkles size={17} />关系档案
        </button>
      )}
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </div>
  );
}

function MessagesView({
  personaList,
  onChat,
  messageChats,
  displayName,
}: {
  personaList: Persona[];
  onChat: (persona: Persona, conversationId?: string) => void;
  messageChats?: RecentChat[];
  displayName?: string;
}) {
  const [search, setSearch] = useState("");
  const chats: RecentChat[] =
    messageChats ??
    seededChats.flatMap((chat) => {
      const persona = findPersonaByKey(personaList, chat.id);
      if (!persona) return [];
      return [{ persona, preview: chat.preview, time: chat.time, unread: chat.unread }];
    });
  const filtered = chats.filter((chat) =>
    `${chat.persona.name}${chat.preview}`.includes(search),
  );
  const unreadTotal = chats.reduce((sum, chat) => sum + chat.unread, 0);
  return (
    <>
      <PageHeader title="消息" subtitle="你的故事，都在这里继续" displayName={displayName} />
      <div className="page-content messages-page">
        <label className="search-box">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索会话" />
        </label>
        <div className="message-tabs">
          <button className="active">全部</button>
          <button>{unreadTotal ? `未读 ${unreadTotal}` : "未读"}</button>
          <button>已收藏</button>
        </div>
        <div className="conversation-list">
          {filtered.map((chat) => (
            <button key={chat.persona.id + (chat.conversationId ?? chat.preview)} onClick={() => onChat(chat.persona, chat.conversationId)}>
              <Portrait persona={chat.persona} />
              <span className="conversation-copy"><strong>{chat.persona.name}</strong><span>{chat.preview}</span></span>
              <span className="conversation-meta"><small>{chat.time}</small>{!!chat.unread && <em>{chat.unread}</em>}</span>
            </button>
          ))}
          {!filtered.length && (
            <div className="empty-state">
              <MessageCircle size={30} /><h3>暂无会话</h3><p>去发现页选一个角色开始对话吧。</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ProfileView({
  onUpgrade,
  displayName,
  isApiMode,
  apiUrl,
  onToggleMode,
  theme,
  onToggleTheme,
}: {
  onUpgrade: () => void;
  displayName?: string;
  isApiMode?: boolean;
  apiUrl?: string;
  onToggleMode?: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const name = displayName ?? "林墨";
  return (
    <>
      <PageHeader title="我的" subtitle="管理你的身份、记忆与偏好" displayName={displayName} />
      <div className="page-content profile-page">
        <section className="profile-card">
          <div className="profile-avatar">{name.slice(0, 1)}<span><Sparkles size={14} /></span></div>
          <div><h2>{name}</h2><p>@{name.toLowerCase().replace(/\s+/g, "")} · Lv. 8 探索者</p><div><span>12 个角色</span><span>86 次对话</span><span>24 段记忆</span></div></div>
          <Button className="secondary">编辑资料</Button>
        </section>
        <section className="profile-mode-card">
          <div>
            <span><Zap size={16} />数据源</span>
            <h3>{isApiMode ? "API 模式" : "Demo 模式"}</h3>
            <p>{isApiMode ? `已连接 ${apiUrl}` : "使用本地模拟数据，无需后端"}</p>
          </div>
          <Button className="secondary" onClick={onToggleMode}>
            切换到 {isApiMode ? "Demo" : "API"}
          </Button>
        </section>
        <section className="profile-mode-card">
          <div>
            <span>{theme === "light" ? <Sun size={16} /> : <Moon size={16} />}界面外观</span>
            <h3>{theme === "light" ? "浅色模式" : "深色模式"}</h3>
            <p>外观偏好会保存在当前设备</p>
          </div>
          <Button className="secondary" onClick={onToggleTheme}>
            切换到{theme === "light" ? "深色" : "浅色"}
          </Button>
        </section>
        <section className="membership-card">
          <div className="membership-glow" />
          <div><span><Crown size={18} />MIRA PLUS</span><h2>让每一个角色真正记住你</h2><p>长期记忆、专属声音、更快回复和无限剧情分支。</p></div>
          <Button className="light" onClick={onUpgrade}>了解会员 <ArrowRight size={17} /></Button>
        </section>
        <section className="profile-grid">
          <div className="settings-card">
            <h3>账户与体验</h3>
            {[
              [UserRound, "账户资料", "昵称、头像与个性签名"],
              [Bell, "通知设置", "角色消息与故事提醒"],
              [ShieldCheck, "隐私与安全", "数据、黑名单与内容等级"],
              [Settings, "通用设置", "语言、外观与辅助功能"],
            ].map(([Icon, title, text]) => {
              const ItemIcon = Icon as typeof UserRound;
              return <button key={String(title)}><ItemIcon size={19} /><span><strong>{String(title)}</strong><small>{String(text)}</small></span><ChevronRight size={17} /></button>;
            })}
          </div>
          <div className="memory-overview">
            <div><h3>记忆空间</h3><span>68%</span></div>
            <div className="memory-meter"><span /></div>
            <p>已保存 24 段共同记忆，Plus 会员可获得无限记忆空间。</p>
            <div className="memory-numbers"><div><strong>7.2h</strong><span>本月对话</span></div><div><strong>14</strong><span>剧情章节</span></div></div>
          </div>
        </section>
      </div>
    </>
  );
}

function CreateView({
  onBack,
  onCreate,
}: {
  onBack: () => void;
  onCreate: (input: {
    name: string;
    subtitle: string;
    bio: string;
    tags: string[];
    greeting: string;
    suggestedReplies: string[];
    systemPrompt: string;
    speakingStyle: Record<string, unknown>;
    knowledgeBoundary: Record<string, unknown>;
    relationshipPreset: Record<string, unknown>;
    memoryPolicy: Record<string, unknown>;
    avatarUrl?: string;
    category: "原创角色";
  }) => Promise<void>;
}) {
  const [name, setName] = useState("月见");
  const [description, setDescription] = useState("来自月海列车的神秘乘务员，总能在你迷路时出现。");
  const [bio, setBio] = useState("她记得每一位乘客想去的地方，也擅长用温柔但清醒的方式陪人梳理困惑。");
  const [greeting, setGreeting] = useState("车窗外正落着星光。欢迎上车——今晚，你想去哪里？");
  const [tags, setTags] = useState(["神秘", "温柔"]);
  const [tagDraft, setTagDraft] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function addTag() {
    const value = tagDraft.trim();
    if (!value || tags.includes(value) || tags.length >= 6) return;
    setTags((items) => [...items, value]);
    setTagDraft("");
  }

  function selectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("请选择 PNG、JPG 或 WebP 图片");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("演示版头像请控制在 2MB 以内");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(String(reader.result));
      setError("");
    };
    reader.onerror = () => setError("图片读取失败，请重试");
    reader.readAsDataURL(file);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onCreate({
        name: name.trim(),
        subtitle: description.trim(),
        bio: bio.trim(),
        tags,
        greeting: greeting.trim(),
        suggestedReplies: ["你来自哪里？", "陪我聊聊今天", "带我看看月海列车"],
        systemPrompt: `你是${name.trim()}，${description.trim()}。${bio.trim()}。始终保持角色身份，用自然、克制、温暖的中文交流；记住用户明确表达的偏好与重要经历，不捏造未知事实。`,
        speakingStyle: { 语气: "温柔、清醒、略带神秘感", 篇幅: "简洁自然" },
        knowledgeBoundary: { 原则: "不知道的内容坦诚说明，不伪造亲历" },
        relationshipPreset: { 初始关系: "刚登上列车的旅客" },
        memoryPolicy: { 优先记住: "称呼、偏好、目标与重要经历" },
        avatarUrl,
        category: "原创角色",
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  const previewPersona: Persona = {
    ...personas.find((persona) => persona.id === "ling")!,
    name: name || "未命名角色",
    subtitle: description,
    intro: bio,
    hook: greeting,
    tags,
    image: avatarUrl,
    atlas: avatarUrl ? undefined : "original",
  };

  return (
    <div className="create-page">
      <header className="simple-header">
        <button onClick={onBack}><ArrowLeft size={20} /></button>
        <div><h1>创建角色</h1><p>让一个新的灵魂在 MIRA 醒来</p></div>
        <span>草稿已保存</span>
      </header>
      <div className="create-layout">
        <form className="create-form" onSubmit={submit}>
          <div className="step-line"><span className="active">1</span><i /><span>2</span><i /><span>3</span></div>
          <div className="form-section">
            <span className="eyebrow">STEP 1 · 基础身份</span>
            <h2>先让我们认识 TA</h2>
            <label><span>角色名称</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label><span>一句话介绍</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>
            <label><span>角色背景</span><textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={4} /></label>
            <label><span>开场白</span><textarea value={greeting} onChange={(event) => setGreeting(event.target.value)} rows={3} /></label>
            <label><span>角色类型</span><div className="select-row"><button type="button" className="active">原创角色</button><button type="button" disabled>历史人物</button><button type="button" disabled>职业人格</button></div></label>
          </div>
          <div className="form-section">
            <span className="eyebrow">外观与气质</span>
            <div className="upload-box">
              {avatarUrl ? (
                <span
                  className="upload-preview"
                  role="img"
                  aria-label="角色头像预览"
                  style={{ backgroundImage: `url("${avatarUrl}")` }}
                />
              ) : <ImagePlus size={25} />}
              <strong>{avatarUrl ? "头像已就绪" : "上传角色立绘"}</strong>
              <span>PNG、JPG 或 WebP，最大 2MB</span>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={selectImage} hidden />
              <button type="button" onClick={() => fileRef.current?.click()}>
                {avatarUrl ? "更换图片" : "选择图片"}
              </button>
            </div>
            <label>
              <span>性格关键词</span>
              <div className="keyword-input">
                {tags.map((tag) => (
                  <button type="button" key={tag} onClick={() => setTags((items) => items.filter((item) => item !== tag))}>
                    {tag} <X size={13} />
                  </button>
                ))}
                <input
                  placeholder="输入后按回车"
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                />
              </div>
            </label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button className="primary" type="submit" disabled={saving || !name.trim() || !description.trim() || !bio.trim() || !greeting.trim()}>
            {saving ? "正在创建…" : "创建并开始对话"} <ArrowRight size={17} />
          </Button>
        </form>
        <aside className="create-preview">
          <span>实时预览</span>
          <div className="preview-phone">
            <Portrait persona={previewPersona} className="preview-art" />
            <div className="preview-copy"><span>原创角色</span><h2>{name || "未命名角色"}</h2><p>{description}</p><div className="tag-row">{tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><Button className="primary wide" disabled><MessageCircle size={17} />创建后即可对话</Button></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function UpgradeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="upgrade-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={19} /></button>
        <span className="modal-crown"><Crown size={24} /></span>
        <span className="eyebrow">MIRA PLUS</span>
        <h2>让关系延续，而不是重新开始</h2>
        <p>这个购买流程也是 Demo，不会产生真实费用。</p>
        <div className="plan-choice active"><span><strong>年度会员</strong><small>¥ 18 / 月，按年支付</small></span><b>¥ 218</b></div>
        <div className="benefit-list">
          {["无限长期记忆", "全部角色声音与语音通话", "更快的模型响应", "无限剧情分支与回溯"].map((item) => <span key={item}><Check size={16} />{item}</span>)}
        </div>
        <Button className="primary wide" onClick={onClose}>模拟开通 Plus</Button>
        <small>随时可以取消 · 7 天免费体验 · 不会真实扣款</small>
      </section>
    </div>
  );
}

export default function PersonaApp() {
  const { mode, isApiMode, apiUrl, setMode } = useApiMode();
  const {
    personaList,
    favorites,
    booting,
    authLoading,
    globalToast,
    conversationId,
    unreadTotal,
    recentChats,
    messageChats,
    displayName,
    showToast,
    handleAuth,
    completeOnboardingFlow,
    toggleFavorite,
    openChat,
    syncThemePreference,
    applyUserTheme,
    user,
    createPersonaFlow,
  } = useMiraApp(isApiMode);

  const toastUnlessExpired = (message: string) => {
    if (message === "登录已过期，请重新登录") return;
    showToast(message);
  };

  const [route, setRoute] = useState<Route>("auth");
  const [selected, setSelected] = useState<Persona>(personas[0]);
  const [upgrade, setUpgrade] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("mira-theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
      return;
    }
    const fromUser = applyUserTheme(user);
    if (fromUser) setTheme(fromUser);
  }, [applyUserTheme, user]);

  useEffect(() => {
    if (!isApiMode || booting) return;
    if (user && route === "auth") {
      setRoute(user.preferences?.onboardingCompleted ? "home" : "onboarding");
    } else if (!user && route !== "auth" && route !== "onboarding") {
      setRoute("auth");
    }
  }, [booting, isApiMode, route, user]);

  useEffect(() => {
    function syncFromHash() {
      const [rawRoute, personaId] = window.location.hash.replace("#", "").split("/");
      if (routeNames.includes(rawRoute as Route)) setRoute(rawRoute as Route);
      if (personaId) {
        const persona = findPersonaByKey(personaList, personaId);
        if (persona) setSelected(persona);
      }
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [personaList]);

  useEffect(() => {
    if (!isApiMode || booting || !user || route !== "chat" || conversationId) return;

    const [, personaKey] = window.location.hash.replace("#", "").split("/");
    if (!personaKey) return;
    const persona = findPersonaByKey(personaList, personaKey);
    if (!persona) return;

    setSelected(persona);
    void openChat(persona);
  }, [booting, conversationId, isApiMode, openChat, personaList, route, user]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("mira-theme", theme);
    void syncThemePreference(theme);
  }, [syncThemePreference, theme]);

  function navigate(next: Route, persona?: Persona) {
    if (persona) setSelected(persona);
    const hash = `#${next}${persona ? `/${persona.id}` : ""}`;
    if (window.location.hash === hash) setRoute(next);
    else window.location.hash = hash;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleNavigateChat(persona: Persona, existingConversationId?: string) {
    const ok = await openChat(persona, existingConversationId);
    if (ok) navigate("chat", persona);
  }

  async function handleLogin(params: {
    isSignup: boolean;
    email: string;
    password: string;
    nickname?: string;
    skipAuth?: boolean;
  }) {
    const nextRoute = await handleAuth(params);
    if (nextRoute !== "auth") navigate(nextRoute);
  }

  async function loadDiscoverPersonas(category: string, query: string) {
    const items = await listPersonas({
      category: category === "为你推荐" ? undefined : category,
      query: query || undefined,
    });
    return items.map(apiPersonaToPersona);
  }

  function toggleApiMode() {
    setMode(isApiMode ? "demo" : "api");
    if (isApiMode) {
      showToast("已切换到演示数据，API 聊天记录仍然保留");
      navigate("home");
    } else {
      showToast("已切换到 API 数据");
      navigate("auth");
    }
  }

  let content: ReactNode;

  if (booting && isApiMode) {
    content = (
      <main className="boot-screen">
        <Logo />
        <p>正在连接 MIRA…</p>
      </main>
    );
  } else if (route === "auth") {
    content = (
      <AuthView
        onLogin={handleLogin}
        loading={authLoading}
        isApiMode={isApiMode}
        personaPreview={personaList}
        onTryDemo={() => {
          setMode("demo");
          navigate("home");
        }}
      />
    );
  } else if (route === "onboarding") {
    content = (
      <OnboardingView
        onDone={() => navigate("home")}
        onComplete={(interests, skipped) => completeOnboardingFlow(interests, skipped)}
      />
    );
  } else if (route === "detail") {
    content = (
      <DetailView
        persona={selected}
        favorite={favorites.includes(selected.id)}
        onFavorite={() => void toggleFavorite(selected.id)}
        onBack={() => window.history.back()}
        onChat={() => void handleNavigateChat(selected)}
      />
    );
  } else if (route === "chat") {
    content = (
      <ChatView
        persona={selected}
        onBack={() => navigate("messages")}
        onDetail={() => navigate("detail", selected)}
        isApiMode={isApiMode}
        conversationId={conversationId}
        onError={toastUnlessExpired}
      />
    );
  } else if (route === "create") {
    content = (
      <CreateView
        onBack={() => navigate("discover")}
        onCreate={async (input) => {
          const created = await createPersonaFlow(input);
          showToast("角色已创建并发布");
          await handleNavigateChat(created);
        }}
      />
    );
  } else {
    content = (
      <div className="app-shell">
        <Sidebar
          route={route}
          onRoute={navigate}
          onCreate={() => navigate("create")}
          displayName={displayName}
          unreadTotal={isApiMode ? unreadTotal : 3}
        />
        <main className="main-area">
          {!isApiMode && (
            <div className="guest-banner">
              <span><Sparkles size={16} />游客体验中：对话仅保存在当前浏览器</span>
              <button onClick={() => { setMode("api"); navigate("auth"); }}>注册后同步数据</button>
            </div>
          )}
          {route === "home" && (
            <HomeView
              personaList={personaList}
              favorites={favorites}
              onFavorite={(id) => void toggleFavorite(id)}
              onPersona={(persona) => navigate("detail", persona)}
              onChat={(persona, conversationIdValue) => void handleNavigateChat(persona, conversationIdValue)}
              onRoute={navigate}
              displayName={displayName}
              recentChats={isApiMode ? recentChats : undefined}
            />
          )}
          {route === "discover" && (
            <DiscoverView
              personaList={personaList}
              favorites={favorites}
              onFavorite={(id) => void toggleFavorite(id)}
              onPersona={(persona) => navigate("detail", persona)}
              isApiMode={isApiMode}
              onLoadCategory={isApiMode ? loadDiscoverPersonas : undefined}
              onError={toastUnlessExpired}
            />
          )}
          {route === "messages" && (
            <MessagesView
              personaList={personaList}
              onChat={(persona, conversationIdValue) => void handleNavigateChat(persona, conversationIdValue)}
              messageChats={isApiMode ? messageChats : undefined}
              displayName={displayName}
            />
          )}
          {route === "profile" && (
            <ProfileView
              onUpgrade={() => setUpgrade(true)}
              displayName={displayName}
              isApiMode={isApiMode}
              apiUrl={apiUrl}
              onToggleMode={toggleApiMode}
              theme={theme}
              onToggleTheme={() => setTheme((value) => (value === "light" ? "dark" : "light"))}
            />
          )}
        </main>
        <MobileNav route={route} onRoute={navigate} unreadTotal={isApiMode ? unreadTotal : 3} />
        {upgrade && <UpgradeModal onClose={() => setUpgrade(false)} />}
      </div>
    );
  }

  return (
    <>
      {content}
      <ApiModeToggle mode={mode} onToggle={toggleApiMode} apiUrl={apiUrl} />
      <ThemeToggle
        theme={theme}
        onToggle={() => setTheme((value) => (value === "light" ? "dark" : "light"))}
      />
      <GlobalToast message={globalToast} />
    </>
  );
}
