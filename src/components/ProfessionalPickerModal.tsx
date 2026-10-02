import { useEffect, useMemo, useState } from "react";
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
  type InfiniteScrollCustomEvent,
} from "@ionic/react";
import { checkmarkCircle, close, personOutline } from "ionicons/icons";
import {
  fetchAvailableProfessionals,
  fetchProfessionalsCatalogPage,
  type ProfessionalCatalogItem,
} from "../utils/appointmentsApi";
import { useT } from "../i18n/I18nContext";

const PAGE_SIZE = 20;

/**
 * Picker de profesional con búsqueda server-side (catálogo paginado) y badge
 * "Con cupo" (disponibilidad en la ventana de días del backend). Nació porque
 * el select del wizard no escala cuando la especialidad tiene cientos de
 * profesionales: el select muestra pocos y este modal el resto.
 */
export function ProfessionalPickerModal({
  isOpen,
  specialtyId,
  organizationId,
  selectedId,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  specialtyId: string;
  /** Organización del paciente; vacía = sin badge de cupo (solo catálogo). */
  organizationId: string;
  selectedId: string;
  onClose: () => void;
  onSelect: (professional: ProfessionalCatalogItem) => void;
}) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ProfessionalCatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDays, setAvailableDays] = useState<Map<string, number>>(
    new Map(),
  );
  const [reloadTick, setReloadTick] = useState(0);

  // Debounce del buscador (300 ms) contra el catálogo del backend.
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  // Al abrir: reset de búsqueda (la página 1 se recarga por efecto).
  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setQuery("");
  }, [isOpen]);

  // Cupo por profesional (best-effort: si falla, el picker sigue usable).
  useEffect(() => {
    if (!isOpen || !specialtyId || !organizationId) return;
    const ctrl = new AbortController();
    void fetchAvailableProfessionals(
      { specialtyId, organizationId },
      { signal: ctrl.signal },
    )
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setAvailableDays(
          new Map(
            res.professionals.map((p) => [p.professionalId, p.availableDays]),
          ),
        );
      })
      .catch(() => {
        /* sin badge: el catálogo sigue siendo suficiente */
      });
    return () => ctrl.abort();
  }, [isOpen, specialtyId, organizationId]);

  // Página 1 cada vez que cambia la búsqueda (o se reintenta).
  useEffect(() => {
    if (!isOpen || !specialtyId) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    void fetchProfessionalsCatalogPage({
      specialtyId,
      status: "Active",
      page: 1,
      pageSize: PAGE_SIZE,
      search: query || undefined,
      signal: ctrl.signal,
    })
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setItems(res.data);
        setTotal(res.total);
        setPage(res.page);
        setTotalPages(res.totalPages);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : t("No se pudieron cargar los profesionales"),
        );
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [isOpen, specialtyId, query, reloadTick, t]);

  const loadMore = async () => {
    if (loading || loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const res = await fetchProfessionalsCatalogPage({
        specialtyId,
        status: "Active",
        page: page + 1,
        pageSize: PAGE_SIZE,
        search: query || undefined,
      });
      setItems((prev) => [...prev, ...res.data]);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch {
      /* la página siguiente es best-effort: el usuario puede reintentar */
    } finally {
      setLoadingMore(false);
    }
  };

  const onInfinite = async (ev: InfiniteScrollCustomEvent) => {
    await loadMore();
    await ev.target.complete();
  };

  // Con cupo primero (por días desc), luego alfabético. Nota: ordena lo
  // cargado; con búsqueda activa el backend ya filtra por nombre.
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const aDays = availableDays.get(a.id) ?? -1;
      const bDays = availableDays.get(b.id) ?? -1;
      if (aDays !== bDays) return bDays - aDays;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [items, availableDays]);

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      className="pro-picker-modal"
    >
      <IonHeader className="pro-picker-head">
        <IonToolbar>
          <IonTitle>{t("Elegir profesional")}</IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label={t("Cerrar")} onClick={onClose}>
              <IonIcon slot="icon-only" icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        <IonSearchbar
          className="pro-picker-search"
          value={search}
          debounce={300}
          placeholder={t("Buscar por nombre")}
          aria-label={t("Buscar por nombre")}
          onIonInput={(e) => setSearch(e.detail.value ?? "")}
        />
      </IonHeader>

      <IonContent className="pro-picker-body">
        {loading ? (
          <div className="req-empty" role="status" aria-live="polite">
            <IonSpinner name="crescent" aria-hidden="true" />
            <strong>{t("Cargando profesionales…")}</strong>
          </div>
        ) : error ? (
          <div className="req-empty" role="alert">
            <strong>{t("No se pudieron cargar los profesionales")}</strong>
            <p>{error}</p>
            <IonButton
              className="bt bt-sm bt-ghost"
              onClick={() => setReloadTick((n) => n + 1)}
            >
              {t("Reintentar")}
            </IonButton>
          </div>
        ) : sorted.length === 0 ? (
          <div className="req-empty">
            <strong>{t("Sin resultados")}</strong>
            <p>{t("Prueba con otro nombre.")}</p>
          </div>
        ) : (
          <IonList className="pro-picker-list">
            {sorted.map((pro) => {
              const days = availableDays.get(pro.id);
              const selected = pro.id === selectedId;
              return (
                <IonItem
                  key={pro.id}
                  button
                  className={`pro-picker-row${selected ? " sel" : ""}`}
                  onClick={() => onSelect(pro)}
                >
                  <span className="pro-picker-ico" aria-hidden="true">
                    <IonIcon icon={personOutline} />
                  </span>
                  <IonLabel className="pro-picker-copy">
                    <strong>{pro.fullName}</strong>
                    {pro.professionalTypeName ? (
                      <small>{pro.professionalTypeName}</small>
                    ) : null}
                  </IonLabel>
                  {days ? (
                    <IonBadge className="pro-picker-badge">
                      {t("Con cupo")}
                    </IonBadge>
                  ) : null}
                  {selected ? (
                    <IonIcon
                      className="pro-picker-check"
                      icon={checkmarkCircle}
                      aria-label={t("Seleccionado")}
                    />
                  ) : null}
                </IonItem>
              );
            })}
          </IonList>
        )}

        {sorted.length > 0 && page < totalPages ? (
          <IonInfiniteScroll onIonInfinite={onInfinite}>
            <IonInfiniteScrollContent
              loadingSpinner="crescent"
              loadingText={t("Cargando más…")}
            />
          </IonInfiniteScroll>
        ) : null}

        {sorted.length > 0 ? (
          <p className="pro-picker-total">
            {t("{count} profesionales", { count: String(total) })}
          </p>
        ) : null}
      </IonContent>
    </IonModal>
  );
}
