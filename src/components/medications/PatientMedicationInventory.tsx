import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
  IonInput,
  IonModal,
  IonSkeletonText,
  IonTextarea,
} from "@ionic/react";
import { cubeOutline } from "ionicons/icons";
import { useI18n } from "../../i18n/I18nContext";
import { useApp } from "../../context/AppContext";
import { getAccessToken } from "../../utils/authApi";
import { sessionUserId } from "../../utils/sessionIdentity";
import { createMedicationRequestId } from "../../utils/medicationsApi";
import { formatDateForDisplay, toLocalISODate } from "../../utils/dates";
import {
  fetchMyInventory,
  isLowMedicationStock,
  saveMyStock,
  fetchMyStockMovements,
  type MedicationSupply,
  type StockRequest,
} from "../../utils/medicationMonitoringApi";

export function PatientMedicationInventory({
  owner,
  canManage,
}: {
  owner: string;
  canManage: boolean;
}) {
  const { t, lang } = useI18n(),
    { showToast } = useApp(),
    cache = useQueryClient();
  const [page, setPage] = useState(1),
    [editing, setEditing] = useState<{
      supply: MedicationSupply;
      kind: StockRequest["kind"];
    } | null>(null),
    [history, setHistory] = useState<MedicationSupply | null>(null);
  const query = useQuery({
    queryKey: ["medications", "inventory", owner, page],
    queryFn: ({ signal }) => fetchMyInventory(owner, page, signal),
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  const ledger = useQuery({
    queryKey: ["medications", "movements", owner, history?.treatmentId],
    queryFn: ({ signal }) =>
      fetchMyStockMovements(owner, history!.treatmentId, signal),
    enabled: Boolean(history),
    retry: false,
    gcTime: 0,
  });
  const number = (v: number) =>
    new Intl.NumberFormat(lang === "en" ? "en-US" : "es-ES", {
      maximumFractionDigits: 4,
    }).format(v);
  const valid = () => sessionUserId(getAccessToken()) === owner;
  if (query.isLoading)
    return (
      <IonSkeletonText animated className="medications-monitoring-skeleton" />
    );
  if (query.isError)
    return (
      <section role="alert" className="medications-state">
        <p>{t("No pudimos cargar el inventario")}</p>
        <IonButton onClick={() => void query.refetch()}>
          {t("Reintentar")}
        </IonButton>
      </section>
    );
  if (editing)
    return (
      <PatientStockForm
        key={
          editing.supply.treatmentId + editing.supply.revision + editing.kind
        }
        owner={owner}
        supply={editing.supply}
        kind={editing.kind}
        onCancel={() => setEditing(null)}
        onSaved={async () => {
          if (!valid()) return;
          await cache.invalidateQueries({
            queryKey: ["medications", "inventory", owner],
          });
          await cache.invalidateQueries({
            queryKey: ["medications", "movements", owner],
          });
          setEditing(null);
          showToast(t("Inventario guardado"), "ok");
        }}
      />
    );
  return (
    <section className="medications-inventory" aria-label={t("Mi inventario")}>
      <div className="medications-section-heading">
        <h2>{t("Mi inventario")}</h2>
        <IonButton fill="clear" onClick={() => void query.refetch()}>
          {t("Actualizar")}
        </IonButton>
      </div>
      {query.data?.items.map((supply) => (
        <IonCard className={`medications-stock-card${isLowMedicationStock(supply) ? " is-low-stock" : ""}`} key={supply.treatmentId}>
          <IonCardHeader className="medications-monitoring-heading">
            <span className="medications-monitoring-icon"><IonIcon icon={cubeOutline} aria-hidden="true" /></span>
            <IonCardTitle title={supply.name}>{supply.name}</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div className="medications-stock-balance">
              <strong>
                {supply.tracked
                  ? `${number(supply.balance)} ${supply.unit}`
                  : t("Sin conteo")}
              </strong>
              {supply.daysRemaining !== null && (
                <IonBadge className="medications-badge">
                  {supply.daysRemaining === 1
                    ? t("1 día")
                    : t("{count} días", {
                        count: String(supply.daysRemaining),
                      })}
                </IonBadge>
              )}
            </div>
            {supply.balance < 0 && (
              <p className="medications-plan-warning">
                {t("Revisa tus existencias")}
              </p>
            )}
            {supply.expiresOn && (
              <p>
                {t("Vencimiento")}: {formatDateForDisplay(supply.expiresOn)}
              </p>
            )}
            {canManage && (
              <div className="medications-stock-actions">
                <IonButton
                  fill="outline"
                  size="small"
                  onClick={() =>
                    setEditing({
                      supply,
                      kind: supply.tracked ? "refill" : "initial",
                    })
                  }
                >
                  {t(
                    supply.tracked
                      ? "Añadir reposición"
                      : "Registrar existencias",
                  )}
                </IonButton>
                {supply.tracked && (
                  <IonButton
                    fill="clear"
                    size="small"
                    onClick={() => setEditing({ supply, kind: "adjustment" })}
                  >
                    {t("Ajustar")}
                  </IonButton>
                )}
              </div>
            )}
            {supply.tracked && (
              <IonButton
                fill="clear"
                size="small"
                onClick={() =>
                  setHistory(
                    history?.treatmentId === supply.treatmentId ? null : supply,
                  )
                }
              >
                {t(
                  history?.treatmentId === supply.treatmentId
                    ? "Cerrar movimientos"
                    : "Ver movimientos",
                )}
              </IonButton>
            )}
            {history?.treatmentId === supply.treatmentId && (
              <section
                className="medications-stock-ledger"
                aria-label={t("Movimientos de inventario")}
              >
                {ledger.isLoading ? (
                  <IonSkeletonText animated />
                ) : ledger.isError ? (
                  <p role="alert">{t("No pudimos cargar los movimientos")}</p>
                ) : (
                  ledger.data?.map((m) => (
                    <div key={m.id}>
                      <span>
                        {formatDateForDisplay(
                          toLocalISODate(new Date(m.recordedAt)),
                        )}{" "}
                        ·{" "}
                        {t(
                          (
                            {
                              initial: "Conteo inicial",
                              refill: "Reposición",
                              adjustment: "Ajuste de inventario",
                              consumption: "Consumo",
                              correction: "Corrección",
                            } as Record<string, string>
                          )[m.kind] ?? m.kind,
                        )}
                      </span>
                      <strong>
                        {m.quantityDelta > 0 ? "+" : ""}
                        {number(m.quantityDelta)} · {t("Saldo")}:{" "}
                        {number(m.balanceAfter)}
                      </strong>
                      {m.reason && <p>{m.reason}</p>}
                    </div>
                  ))
                )}
              </section>
            )}
          </IonCardContent>
        </IonCard>
      ))}
      {!query.data?.items.length && (
        <p>{t("Añade un medicamento para registrar sus existencias.")}</p>
      )}
      {query.data && query.data.total > query.data.pageSize && (
        <div className="medications-stock-actions">
          <IonButton
            fill="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("Anterior")}
          </IonButton>
          <span>{page}</span>
          <IonButton
            fill="outline"
            disabled={page * query.data.pageSize >= query.data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("Siguiente")}
          </IonButton>
        </div>
      )}
    </section>
  );
}
function PatientStockForm({
  owner,
  supply,
  kind,
  onSaved,
  onCancel,
}: {
  owner: string;
  supply: MedicationSupply;
  kind: StockRequest["kind"];
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const { t, lang } = useI18n();
  const [quantity, setQuantity] = useState(""),
    [reason, setReason] = useState(""),
    [expiresOn, setExpiresOn] = useState<string | null>(supply.expiresOn),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const id = useId().replace(/:/g, ""),
    operation = useRef<{ signature: string; body: StockRequest } | null>(null);
  const valid = () => sessionUserId(getAccessToken()) === owner;
  async function save() {
    if (saving || !valid()) return;
    const value = Number(quantity.replace(",", "."));
    if (
      !quantity.trim() ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1000000 ||
      (kind === "refill" && value === 0) ||
      (kind === "adjustment" && !reason.trim())
    ) {
      setError(t("Revisa la cantidad y el motivo."));
      return;
    }
    const body = {
      kind,
      quantity: value,
      expectedRevision: supply.revision,
      expiresOn,
      reason: reason.trim() || null,
    };
    const signature = JSON.stringify(body);
    if (operation.current?.signature !== signature)
      operation.current = {
        signature,
        body: { ...body, clientRequestId: createMedicationRequestId() },
      };
    setSaving(true);
    setError("");
    try {
      await saveMyStock(owner, supply.treatmentId, operation.current.body);
      if (valid()) await onSaved();
    } catch {
      if (valid())
        setError(t("No pudimos guardar. Actualiza e inténtalo de nuevo."));
    } finally {
      if (valid()) setSaving(false);
    }
  }
  return (
    <section>
      <div className="medications-section-heading">
        <h2>
          {t(
            kind === "initial"
              ? "Registrar existencias"
              : kind === "refill"
                ? "Añadir reposición"
                : "Ajustar existencias",
          )}
        </h2>
        <IonButton fill="clear" disabled={saving} onClick={onCancel}>
          {t("Cancelar")}
        </IonButton>
      </div>
      <p className="medications-form-product">
        {supply.name} · {supply.unit}
      </p>
      <form
        className="medications-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <IonInput
          label={t("Cantidad")}
          labelPlacement="stacked"
          inputmode="decimal"
          value={quantity}
          required
          disabled={saving}
          onIonInput={(e) => setQuantity(e.detail.value ?? "")}
        />
        <IonCheckbox
          checked={Boolean(expiresOn)}
          disabled={saving}
          onIonChange={(e) =>
            setExpiresOn(e.detail.checked ? toLocalISODate() : null)
          }
        >
          {t("Añadir vencimiento")}
        </IonCheckbox>
        {expiresOn && (
          <>
            <IonDatetimeButton
              datetime={"stock-expiry-" + id}
              disabled={saving}
            />
            <IonModal keepContentsMounted className="medications-date-modal">
              <IonDatetime
                id={"stock-expiry-" + id}
                presentation="date"
                locale={lang === "en" ? "en-US" : "es-ES"}
                value={expiresOn}
                showDefaultButtons
                doneText={t("Listo")}
                cancelText={t("Cancelar")}
                onIonChange={(e) => {
                  if (typeof e.detail.value === "string")
                    setExpiresOn(e.detail.value.slice(0, 10));
                }}
              />
            </IonModal>
          </>
        )}
        <IonTextarea
          label={t("Motivo")}
          labelPlacement="stacked"
          value={reason}
          required={kind === "adjustment"}
          maxlength={500}
          rows={2}
          disabled={saving}
          onIonInput={(e) => setReason(e.detail.value ?? "")}
        />
        {error && (
          <p role="alert" className="medications-error">
            {error}
          </p>
        )}
        <IonButton type="submit" expand="block" disabled={saving}>
          {t(saving ? "Guardando…" : "Guardar inventario")}
        </IonButton>
      </form>
    </section>
  );
}
