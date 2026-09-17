import { useEffect, useMemo, useRef, useState } from "react";
import { useSubscription } from "urql";
import { IonButton, IonIcon, IonSearchbar } from "@ionic/react";
import {
  albumsOutline,
  arrowBack,
  calendarOutline,
  chevronForward,
  peopleOutline,
  qrCodeOutline,
  radioOutline,
  sendOutline,
} from "ionicons/icons";
import type {
  Profile,
  Post,
  Comment,
  PostAuthor,
} from "../../graphql/community";
import type { FeedPostView } from "../../hooks/useCommunity";
import { useI18n } from "../../i18n/I18nContext";
import type { ToastKind } from "../../types";
import type {
  Club,
  ClubEvent,
  ClubPost,
  LiveSession,
} from "../../graphql/clubs";
import {
  fetchClubs,
  fetchMyClubs,
  fetchClub,
  fetchClubFeed,
  fetchClubEvents,
  fetchClubLiveSessions,
  joinClubDirect,
  joinWithInvitation,
  requestMembership,
  leaveClub,
  confirmAttendance,
  joinWaitlist,
  checkIn,
  sendLiveChatMessage,
  toggleClubPostLike,
  addClubComment,
  voteClubPoll,
} from "../../services/clubs-api";
import { LIVE_CHAT_MESSAGE_ADDED } from "../../graphql/clubs-operations";
import {
  CLUB_CATEGORIES,
  coverGradient,
  formatDateTime,
  initials,
} from "../../utils/clubs-helpers";
import { EmptyState } from "./community";
import { PostCard } from "./PostCard";

interface ClubsSectionProps {
  me: Profile | null;
  onToast: (message: string, kind?: ToastKind) => void;
}

type InnerTab = "info" | "feed" | "eventos" | "lives";

/** Sección "Clubes" integrada en la Comunidad: lista de clubes + detalle
 *  con feed (PostCard), eventos y lives. Datos mock (contrato congelado). */
export function ClubsSection({ me, onToast }: ClubsSectionProps) {
  const { t } = useI18n();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [selected, setSelected] = useState<Club | null>(null);
  const [innerTab, setInnerTab] = useState<InnerTab>("info");
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [lives, setLives] = useState<LiveSession[]>([]);
  const [requested, setRequested] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [liveChat, setLiveChat] = useState<LiveSession | null>(null);
  const [draft, setDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  /* Chat del live en vivo: cuando el modal está abierto, suscribimos mensajes
     nuevos y los anexamos al chat local sin refetch. */
  const liveChatRef = useRef(liveChat);
  liveChatRef.current = liveChat;
  const [liveSub] = useSubscription<{
    liveChatMessageAdded: {
      id: string;
      senderProfileId: string;
      body: string;
      sentAt: string;
    };
  }>({
    query: LIVE_CHAT_MESSAGE_ADDED,
    variables: { liveId: liveChat?.id ?? "" },
    pause: !liveChat,
  });
  useEffect(() => {
    const msg = liveSub.data?.liveChatMessageAdded;
    if (!msg || !liveChatRef.current) return;
    setLiveChat((prev) => {
      if (!prev || prev.chat.some((m) => m.id === msg.id)) return prev;
      return {
        ...prev,
        chat: [
          ...prev.chat,
          {
            id: msg.id,
            sender: { id: msg.senderProfileId, displayName: "Miembro" },
            body: msg.body,
            sentAt: msg.sentAt,
          },
        ],
      };
    });
  }, [liveSub.data]);

  const reloadClubs = async () => {
    const [all, mine] = await Promise.all([fetchClubs({}), fetchMyClubs()]);
    setClubs(all);
    setMyClubs(mine);
    setLoading(false);
  };

  useEffect(() => {
    void reloadClubs();
  }, []);

  const loadClub = async (clubId: string) => {
    const [c, p, e, l] = await Promise.all([
      fetchClub(clubId),
      fetchClubFeed(clubId),
      fetchClubEvents(clubId),
      fetchClubLiveSessions(clubId),
    ]);
    setSelected(c);
    setPosts(
      c.myMembership ? p : p.filter((post) => post.visibility === "PUBLICO"),
    );
    setEvents(e);
    setLives(l);
    setRequested(false);
  };

  const openClub = async (clubId: string) => {
    setSelected(null);
    setInnerTab("info");
    await loadClub(clubId);
  };

  const backToList = () => {
    setSelected(null);
    void reloadClubs();
  };

  const visibleClubs = useMemo(() => {
    const query = q.trim().toLowerCase();
    return clubs.filter((c) => {
      if (onlyMine && c.myMembership === null) return false;
      if (category !== "all" && c.category !== category) return false;
      if (
        query &&
        !`${c.name} ${c.description} ${c.tags.join(" ")}`
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [clubs, q, category, onlyMine]);

  const isMember = selected?.myMembership !== null;

  const join = async () => {
    if (!selected) return;
    if (selected.visibility === "PUBLICO") {
      await joinClubDirect(selected.id);
      onToast(t("Te uniste al club"));
      await loadClub(selected.id);
    } else if (selected.visibility === "PRIVADO") {
      await requestMembership(selected.id);
      setRequested(true);
      onToast(t("Solicitud enviada"), "info");
    } else {
      setQrOpen(true);
    }
  };

  const joinWithInvite = async () => {
    if (!selected) return;
    const token = (inviteToken.trim() || inviteTokenFromUrl()) as string;
    if (!token) {
      onToast(t("Pega el código de invitación"), "info");
      return;
    }
    try {
      await joinWithInvitation(selected.id, token);
      setQrOpen(false);
      onToast(t("Te uniste al club"));
      await loadClub(selected.id);
    } catch {
      onToast(t("La invitación no es válida o ya expiró"), "err");
    }
  };

  const inviteTokenFromUrl = (): string | null => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("club-token");
    return t && t.trim().length > 0 ? t.trim() : null;
  };

  const exit = async () => {
    if (!selected) return;
    await leaveClub(selected.id);
    onToast(t("Saliste del club"), "info");
    await loadClub(selected.id);
  };

  const attend = async (event: ClubEvent) => {
    if (event.status === "LLENO") {
      await joinWaitlist(event.id);
      onToast(t("Te agregamos a la lista de espera"), "info");
    } else {
      await confirmAttendance(event.id);
      onToast(t("Asistencia confirmada"));
    }
    await loadClub(event.clubId);
  };

  const doCheckIn = async (event: ClubEvent) => {
    await checkIn(event.id);
    onToast(t("Check-in registrado"));
    await loadClub(event.clubId);
  };

  const sendChat = async () => {
    if (!selected || !liveChat || !draft.trim()) return;
    await sendLiveChatMessage(liveChat.id, draft.trim());
    setDraft("");
  };

  const toggleLike = async (clubId: string, post: ClubPost) => {
    const updated = await toggleClubPostLike(clubId, post.id);
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const submitComment = async (post: ClubPost) => {
    const body = (commentDraft[post.id] ?? "").trim();
    if (!body || !selected) return;
    const updated = await addClubComment(selected.id, post.id, body);
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setCommentDraft((prev) => ({ ...prev, [post.id]: "" }));
  };

  const votePoll = async (optionId: string) => {
    if (!selected) return;
    const updated = await voteClubPoll(selected.id, optionId);
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const myId = me?.id ?? null;

  /* ── Detalle del club ─────────────────────────────────────────────── */

  if (selected) {
    const feedViews: FeedPostView[] = posts.map((p) => {
      const likedByMe = myId != null && p.likes.includes(myId);
      return {
        post: toFeedPost(p),
        likeCount: p.likes.length,
        likedByMe,
        repostCount: 0,
        repostedByMe: false,
      };
    });

    return (
      <>
        <div style={{ padding: "12px 14px 0" }}>
          <button
            type="button"
            onClick={backToList}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <IonIcon icon={arrowBack} /> {t("Volver a clubes")}
          </button>
        </div>
        <div
          style={{
            margin: "10px 14px 0",
            height: 170,
            borderRadius: 20,
            background: selected.coverUrl
              ? `url(${selected.coverUrl}) center/cover no-repeat`
              : coverGradient(selected.category),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {!selected.coverUrl && (
          <span
            style={{
              fontSize: 52,
              fontWeight: 900,
              color: "rgba(255,255,255,0.9)",
              letterSpacing: 2,
            }}
          >
            {initials(selected.name)}
          </span>
          )}
          <span
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              background: "rgba(255,255,255,0.22)",
              backdropFilter: "blur(6px)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              padding: "4px 12px",
              borderRadius: 99,
            }}
          >
            {t(selected.category)}
          </span>
          <span
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              background: "rgba(0,0,0,0.35)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              padding: "4px 12px",
              borderRadius: 99,
            }}
          >
            {t(visibilityText(selected.visibility))}
          </span>
          {isMember && (
            <span
              style={{
                position: "absolute",
                bottom: 12,
                right: 12,
                background: "rgba(255,255,255,0.9)",
                color: "#111",
                fontSize: 11,
                fontWeight: 900,
                padding: "4px 12px",
                borderRadius: 99,
              }}
            >
              {t(roleText(selected.myMembership!))}
            </span>
          )}
        </div>
        <div
          style={{
            padding: "14px 16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <h1 style={{ fontSize: 21, fontWeight: 900, margin: 0 }}>
            {selected.name}
          </h1>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--ion-color-medium)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {selected.description}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <StatPill
              icon={peopleOutline}
              text={`${selected.memberCount} ${t("miembros")}`}
            />
            <StatPill
              icon={calendarOutline}
              text={`${events.length} ${t("eventos")}`}
            />
            <StatPill
              icon={radioOutline}
              text={`${lives.length} ${t("lives")}`}
            />
            {selected.maxMembers && (
              <StatPill
                icon={peopleOutline}
                text={`${t("Capacidad")} ${selected.maxMembers}`}
              />
            )}
          </div>

          {!isMember ? (
            <IonButton expand="block" onClick={join}>
              {selected.visibility === "PRIVADO"
                ? requested
                  ? t("Solicitud enviada")
                  : t("Solicitar ingreso")
                : selected.visibility === "INVITACION"
                  ? t("Tengo invitación")
                  : t("Unirme al club")}
            </IonButton>
          ) : (
            <IonButton expand="block" fill="outline" onClick={exit}>
              {t("Salir del club")}
            </IonButton>
          )}

          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              padding: "6px 0",
            }}
          >
            {(
              [
                ["info", albumsOutline, t("Información")],
                ["feed", albumsOutline, t("Feed")],
                ["eventos", calendarOutline, t("Eventos")],
                ["lives", radioOutline, t("Lives")],
              ] as const
            ).map(([id, icon, label]) => (
              <IonButton
                key={id}
                size="small"
                fill={innerTab === id ? "solid" : "outline"}
                shape="round"
                onClick={() => setInnerTab(id)}
              >
                <IonIcon icon={icon} slot="start" />
                {label}
              </IonButton>
            ))}
          </div>

          {innerTab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Block
                title={t("Reglas")}
                lines={selected.rules}
                empty={t("Sin reglas definidas")}
              />
              <Block
                title={t("Objetivos")}
                lines={selected.objectives}
                empty={t("Sin objetivos definidos")}
              />
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                  {t("Etiquetas")}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selected.tags.map((tag) => (
                    <Pill key={tag} label={`#${tag}`} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {innerTab === "feed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {!isMember && (
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--ion-color-medium)",
                    margin: 0,
                  }}
                >
                  {t("Únete al club para comentar y reaccionar")}
                </p>
              )}
              {feedViews.length === 0 ? (
                <EmptyState
                  icon={albumsOutline}
                  title={t("Aún no hay publicaciones")}
                  hint={t("Las publicaciones del club aparecerán aquí")}
                />
              ) : (
                feedViews.map((view, i) => (
                  <div key={view.post.id}>
                    <PostCard
                      view={view}
                      index={i}
                      onOpen={() => undefined}
                      onToggleLike={async () => {
                        await toggleLike(
                          selected.id,
                          posts.find((p) => p.id === view.post.id)!,
                        );
                      }}
                      onVotePoll={async (optionId) => {
                        await votePoll(optionId);
                        const post = posts.find((p) => p.id === view.post.id);
                        if (!post) return view.post;
                        return toFeedPost(
                          await fetchClubFeed(selected.id).then(
                            (fp) => fp.find((x) => x.id === post.id) ?? post,
                          ),
                        );
                      }}
                      myId={myId}
                      onToast={onToast}
                    />
                    {isMember && (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          padding: "0 12px 12px",
                        }}
                      >
                        <input
                          value={commentDraft[view.post.id] ?? ""}
                          onChange={(e) =>
                            setCommentDraft((prev) => ({
                              ...prev,
                              [view.post.id]: e.target.value,
                            }))
                          }
                          placeholder={t("Comentar…")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const post = posts.find(
                                (p) => p.id === view.post.id,
                              );
                              if (post) void submitComment(post);
                            }
                          }}
                          style={{
                            flex: 1,
                            borderRadius: 99,
                            border: "1px solid var(--ion-color-light-shade)",
                            padding: "8px 14px",
                            fontSize: 13,
                            background: "var(--ion-background-color)",
                          }}
                        />
                        <IonButton
                          size="small"
                          disabled={!(commentDraft[view.post.id] ?? "").trim()}
                          onClick={() => {
                            const post = posts.find(
                              (p) => p.id === view.post.id,
                            );
                            if (post) void submitComment(post);
                          }}
                        >
                          <IonIcon icon={sendOutline} />
                        </IonButton>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {innerTab === "eventos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {events.length === 0 ? (
                <EmptyState
                  icon={calendarOutline}
                  title={t("Este club aún no tiene eventos")}
                  hint={t("Próximamente habrá actividades del club")}
                />
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: 12,
                      borderRadius: 16,
                      border: "1px solid var(--ion-color-light-shade)",
                      background: "var(--ion-background-color)",
                    }}
                  >
                    <DatePill iso={event.startsAt} type={event.type} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          margin: "0 0 4px",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0 }}>
                          {event.title}
                        </span>
                        {event.status === "LLENO" && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 900,
                              color: "#fff",
                              background: "var(--ion-color-warning)",
                              padding: "2px 8px",
                              borderRadius: 99,
                            }}
                          >
                            {t("Lleno")}
                          </span>
                        )}
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--ion-color-medium)",
                          margin: "0 0 6px",
                          lineHeight: 1.45,
                        }}
                      >
                        {event.type === "PRESENCIAL"
                          ? (event.location ?? t("Sin ubicación"))
                          : t("Virtual")}
                      </p>
                      <div
                        style={{
                          height: 5,
                          borderRadius: 99,
                          background: "var(--ion-color-light)",
                          overflow: "hidden",
                          margin: "0 0 6px",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${event.maxAttendees ? Math.min(100, Math.round((event.confirmedCount / event.maxAttendees) * 100)) : Math.min(100, event.confirmedCount * 4)}%`,
                            borderRadius: 99,
                            background:
                              event.maxAttendees &&
                              event.confirmedCount >= event.maxAttendees
                                ? "var(--ion-color-warning)"
                                : "var(--ion-color-primary)",
                          }}
                        />
                      </div>
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--ion-color-medium)",
                          margin: "0 0 8px",
                        }}
                      >
                        {event.confirmedCount}
                        {event.maxAttendees
                          ? `/${event.maxAttendees}`
                          : ""}{" "}
                        {t("confirmados")}
                        {event.waitlistCount > 0 &&
                          ` · ${event.waitlistCount} ${t("en espera")}`}
                      </p>
                      {event.myAttendance === null && (
                        <IonButton
                          size="small"
                          onClick={() => void attend(event)}
                        >
                          {event.status === "LLENO"
                            ? t("Lista de espera")
                            : t("Confirmar asistencia")}
                        </IonButton>
                      )}
                      {event.myAttendance === "CONFIRMADO" && (
                        <IonButton
                          size="small"
                          fill="outline"
                          onClick={() => void doCheckIn(event)}
                        >
                          {t("Check-in")}
                        </IonButton>
                      )}
                      {event.myAttendance === "LISTA_ESPERA" && (
                        <span
                          style={{
                            fontSize: 12.5,
                            color: "var(--ion-color-warning)",
                          }}
                        >
                          {t("En lista de espera")}
                        </span>
                      )}
                      {event.myAttendance === "CHECKIN" && (
                        <span
                          style={{
                            fontSize: 12.5,
                            color: "var(--ion-color-success)",
                          }}
                        >
                          {t("Check-in registrado")}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {innerTab === "lives" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {lives.length === 0 ? (
                <EmptyState
                  icon={radioOutline}
                  title={t("Este club aún no tiene lives")}
                  hint={t("Las transmisiones en vivo del club aparecerán aquí")}
                />
              ) : (
                lives.map((live) => (
                  <div
                    key={live.id}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      border: "1px solid var(--ion-color-light-shade)",
                      background: "var(--ion-background-color)",
                    }}
                  >
                    <div
                      style={{
                        height: 100,
                        borderRadius: 10,
                        marginBottom: 8,
                        background:
                          live.status === "ACTIVO"
                            ? "linear-gradient(135deg, rgba(255,59,48,0.18), rgba(255,59,48,0.04))"
                            : "linear-gradient(135deg, rgba(124,58,237,0.14), var(--ion-color-light))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        position: "relative",
                      }}
                    >
                      {live.status === "ACTIVO" && (
                        <span
                          className="live-pulse"
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            background: "var(--ion-color-danger)",
                            color: "#fff",
                            fontSize: 9.5,
                            fontWeight: 900,
                            letterSpacing: 1,
                            padding: "3px 9px",
                            borderRadius: 99,
                          }}
                        >
                          {t("EN VIVO")}
                        </span>
                      )}
                      <IonIcon
                        icon={radioOutline}
                        style={{
                          fontSize: 24,
                          color:
                            live.status === "ACTIVO"
                              ? "var(--ion-color-danger)"
                              : "var(--ion-color-primary)",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          letterSpacing: 1,
                          color: "var(--ion-color-danger)",
                        }}
                      >
                        {live.status === "ACTIVO"
                          ? t("EN VIVO")
                          : t("LIVE COPP ADRESD")}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        margin: "0 0 4px",
                      }}
                    >
                      {live.title}
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--ion-color-medium)",
                        margin: "0 0 8px",
                      }}
                    >
                      {formatDateTime(live.scheduledStartAt)}
                    </p>
                    {live.status === "ACTIVO" && (
                      <IonButton size="small" onClick={() => setLiveChat(live)}>
                        {t("Entrar al live")}
                      </IonButton>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal invitación QR */}
        {qrOpen && (
          <ModalOverlay onClose={() => setQrOpen(false)}>
            <IonIcon
              icon={qrCodeOutline}
              style={{ fontSize: 90, color: "var(--ion-color-dark)" }}
            />
            <p style={{ fontSize: 13, textAlign: "center", margin: 0 }}>
              {t(
                "Club solo por invitación: escanea el QR o usa el enlace del organizador",
              )}
            </p>
            <input
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
              placeholder={t("Código de invitación")}
              style={{
                width: "100%",
                borderRadius: 99,
                border: "1px solid var(--ion-color-light-shade)",
                padding: "9px 14px",
                fontSize: 13,
                textAlign: "center",
                background: "var(--ion-background-color)",
              }}
            />
            <IonButton expand="block" onClick={() => void joinWithInvite()}>
              {t("Unirme con invitación")}
            </IonButton>
          </ModalOverlay>
        )}

        {/* Modal live con chat */}
        {liveChat && (
          <ModalOverlay onClose={() => setLiveChat(null)}>
            <p style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>
              {liveChat.title}
            </p>
            <div
              style={{
                height: 120,
                borderRadius: 10,
                background:
                  "linear-gradient(135deg, rgba(255,59,48,0.15), var(--ion-color-light))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <IonIcon
                icon={radioOutline}
                style={{ fontSize: 22, color: "var(--ion-color-danger)" }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1,
                  color: "var(--ion-color-danger)",
                }}
              >
                {t("EN VIVO")}
              </span>
            </div>
            <div
              style={{
                height: 150,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {liveChat.chat.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--ion-color-medium)" }}>
                  {t("Aún no hay mensajes")}
                </p>
              ) : (
                liveChat.chat.map((m) => (
                  <div
                    key={m.id}
                    style={{ display: "flex", gap: 6, fontSize: 12.5 }}
                  >
                    <span style={{ fontWeight: 800, flexShrink: 0 }}>
                      {m.sender.displayName}:
                    </span>
                    <span>{m.body}</span>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("Escribe un mensaje…")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendChat();
                }}
                style={{
                  flex: 1,
                  borderRadius: 99,
                  border: "1px solid var(--ion-color-light-shade)",
                  padding: "9px 14px",
                  fontSize: 13,
                  background: "var(--ion-background-color)",
                }}
              />
              <IonButton
                size="small"
                onClick={() => void sendChat()}
                disabled={!draft.trim()}
              >
                <IonIcon icon={sendOutline} />
              </IonButton>
            </div>
          </ModalOverlay>
        )}
      </>
    );
  }

  /* ── Lista de clubes ──────────────────────────────────────────────── */

  return (
    <>
      <div
        style={{
          padding: "0 14px 8px",
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0, flex: 1 }}>
          {t("Clubes")}
        </h2>
        <IonButton
          size="small"
          fill={onlyMine ? "solid" : "outline"}
          shape="round"
          onClick={() => setOnlyMine((v) => !v)}
        >
          {t("Mis clubes")} ({myClubs.length})
        </IonButton>
      </div>
      <div style={{ padding: "0 14px 8px" }}>
        <IonSearchbar
          value={q}
          onIonInput={(e) => setQ(e.target.value ?? "")}
          placeholder={t("Buscar clubes…")}
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          padding: "0 14px 10px",
        }}
      >
        <Chip
          active={category === "all"}
          label={t("Todos")}
          onClick={() => setCategory("all")}
        />
        {CLUB_CATEGORIES.map((c) => (
          <Chip
            key={c}
            active={category === c}
            label={t(c)}
            onClick={() => setCategory(c)}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "0 14px 24px",
        }}
      >
        {loading ? (
          <EmptyState
            icon={albumsOutline}
            title={t("Cargando clubes…")}
            hint=""
          />
        ) : visibleClubs.length === 0 ? (
          <EmptyState
            icon={albumsOutline}
            title={t("No se encontraron clubes")}
            hint={t("Prueba con otra búsqueda o categoría")}
          />
        ) : (
          visibleClubs.map((club) => (
            <button
              key={club.id}
              type="button"
              onClick={() => void openClub(club.id)}
              className="com-club-card"
              style={{
                display: "flex",
                flexDirection: "column",
                textAlign: "left",
                borderRadius: 20,
                overflow: "hidden",
                border: "1px solid var(--ion-color-light-shade)",
                background: "var(--ion-background-color)",
                boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
              }}
            >
              <div
                style={{
                  height: 96,
                  background: club.coverUrl
                    ? `url(${club.coverUrl}) center/cover no-repeat`
                    : coverGradient(club.category),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                {!club.coverUrl && (
                <span
                  style={{
                    fontSize: 30,
                    fontWeight: 900,
                    color: "rgba(255,255,255,0.9)",
                    letterSpacing: 1,
                  }}
                >
                  {initials(club.name)}
                </span>
                )}
                <span
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    background: "rgba(255,255,255,0.22)",
                    backdropFilter: "blur(6px)",
                    color: "#fff",
                    fontSize: 10.5,
                    fontWeight: 800,
                    padding: "4px 10px",
                    borderRadius: 99,
                  }}
                >
                  {t(club.category)}
                </span>
                {club.myMembership && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 10,
                      right: 10,
                      background: "rgba(0,0,0,0.35)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "3px 9px",
                      borderRadius: 99,
                    }}
                  >
                    {t("Miembro")} · {t(roleText(club.myMembership))}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: "12px 14px 14px",
                }}
              >
                <span style={{ fontWeight: 900, fontSize: 15 }}>
                  {club.name}
                </span>
                <span
                  style={{ fontSize: 12, color: "var(--ion-color-medium)" }}
                >
                  {t(visibilityText(club.visibility))} · {club.memberCount}{" "}
                  {t("miembros")}
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 2,
                    fontSize: 11.5,
                    color: "var(--ion-color-primary)",
                    fontWeight: 800,
                  }}
                >
                  {t("Ver el club")}
                  <IonIcon icon={chevronForward} style={{ fontSize: 11 }} />
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );
}

/** Convierte un post de club al shape `Post` que consume PostCard. */
export function toFeedPost(p: ClubPost): Post {
  const author: PostAuthor = {
    id: p.author.id,
    displayName: p.author.displayName,
    avatarUrl: p.author.avatarUrl ?? null,
    isSystem: false,
  };
  return {
    id: p.id,
    body: p.body,
    pinned: p.pinned,
    imageUrl: null,
    mediaType: null,
    poll: p.poll
      ? {
          id: p.poll.id,
          options: p.poll.options.map((o) => ({
            id: o.id,
            text: o.text,
            votes: o.votes.map((v) => ({ id: v, profileId: v })),
          })),
        }
      : null,
    createdAt: p.createdAt,
    profile: author,
    likes: p.likes.map((l) => ({ id: l, profileId: l })),
    reposts: [],
    comments: p.comments.map((c): Comment => ({
      id: c.id,
      postId: p.id,
      parentCommentId: null,
      body: c.body,
      createdAt: c.createdAt,
      profile: {
        id: c.author.id,
        displayName: c.author.displayName,
        avatarUrl: c.author.avatarUrl ?? null,
      },
      likes: c.likes.map((l) => ({ id: l, profileId: l })),
      replies: [],
    })),
  };
}

/** Pill de estadística con icono (estilo IG). */
function StatPill({ icon, text }: { icon: string; text: string }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 12px",
        borderRadius: 99,
        background: "var(--ion-color-light)",
        fontSize: 12,
        fontWeight: 800,
        color: "var(--ion-color-dark)",
      }}
    >
      <IonIcon
        icon={icon}
        style={{ fontSize: 13, color: "var(--ion-color-primary)" }}
      />
      {text}
    </span>
  );
}

/** Pill de fecha estilo IG: día grande + mes + icono de tipo. */
function DatePill({ iso, type }: { iso: string; type: ClubEvent["type"] }) {
  const d = new Date(iso);
  return (
    <span
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: 58,
        height: 64,
        borderRadius: 16,
        background:
          type === "PRESENCIAL"
            ? "linear-gradient(160deg, var(--ion-color-primary), #5b21b6)"
            : "linear-gradient(160deg, #0891b2, #0e7490)",
        color: "#fff",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>
        {d.getDate()}
      </span>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {d.toLocaleDateString("es-CO", { month: "short" }).replace(".", "")}
      </span>
      <IonIcon
        icon={type === "PRESENCIAL" ? calendarOutline : radioOutline}
        style={{ fontSize: 11, marginTop: 3 }}
      />
    </span>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 99,
        background: "var(--ion-color-light)",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--ion-color-medium)",
      }}
    >
      {label}
    </span>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <IonButton
      size="small"
      fill={active ? "solid" : "outline"}
      shape="round"
      onClick={onClick}
    >
      {label}
    </IonButton>
  );
}

function Block({
  title,
  lines,
  empty,
}: {
  title: string;
  lines: string[];
  empty: string;
}) {
  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>{title}</p>
      {lines.length === 0 ? (
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ion-color-medium)",
            margin: 0,
          }}
        >
          {empty}
        </p>
      ) : (
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {lines.map((line, i) => (
            <li key={i} style={{ fontSize: 13, lineHeight: 1.45 }}>
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--ion-background-color)",
          borderRadius: 20,
          padding: 22,
          width: "100%",
          maxWidth: 340,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function visibilityText(visibility: Club["visibility"]): string {
  switch (visibility) {
    case "PUBLICO":
      return "Público";
    case "PRIVADO":
      return "Privado";
    case "INVITACION":
      return "Solo invitación";
  }
}

function roleText(role: string): string {
  switch (role) {
    case "ADMIN":
      return "Administrador";
    case "MODERADOR":
      return "Moderador";
    default:
      return "Miembro";
  }
}
