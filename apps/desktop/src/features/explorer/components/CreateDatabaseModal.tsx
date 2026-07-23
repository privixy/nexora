import { useEffect, useState, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import { Database, Loader2, X } from "lucide-react";
import { Modal } from "../../../shared/ui/Modal";
import { toErrorMessage } from "../../../shared/lib/errors";

interface CreateDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (database: string) => Promise<void>;
}

export const CreateDatabaseModal = ({ isOpen, onClose, onCreate }: CreateDatabaseModalProps) => {
  const { t } = useTranslation();
  const [database, setDatabase] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDatabase("");
      setError("");
      setIsCreating(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    const nextDatabase = database.trim();
    if (!nextDatabase) {
      setError(t("sidebar.createDatabasePrompt"));
      return;
    }

    setIsCreating(true);
    setError("");
    try {
      await onCreate(nextDatabase);
      onClose();
    } catch (e) {
      console.error(e);
      setError(t("sidebar.failCreateDatabase") + toErrorMessage(e));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="bg-elevated border border-strong rounded-xl shadow-2xl w-[480px] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-default bg-base">
          <div className="flex items-center gap-3">
            <div className="bg-blue-900/30 p-2 rounded-lg">
              <Database className="text-blue-400" size={20} />
            </div>
            <h2 className="text-lg font-semibold text-primary">{t("sidebar.createDatabase")}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-secondary hover:text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs uppercase font-bold text-muted mb-1">{t("sidebar.createDatabasePrompt")}</label>
            <input
              value={database}
              onChange={(e) => {
                setDatabase(e.target.value);
                setError("");
              }}
              className={`w-full bg-base border rounded-lg px-3 py-2 text-primary focus:border-blue-500 focus:outline-none transition-all font-mono ${!database.trim() && error ? "border-red-500" : "border-strong"}`}
              placeholder={t("sidebar.createDatabasePrompt")}
              autoFocus
            />
          </div>
          {error && <div className="text-red-400 text-sm">{error}</div>}
        </div>

        <div className="p-4 border-t border-default bg-base/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-secondary hover:text-primary hover:bg-surface-secondary rounded transition-colors text-sm"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating && <Loader2 size={14} className="animate-spin" />}
            {isCreating ? t("common.loading") : t("sidebar.createDatabase")}
          </button>
        </div>
      </form>
    </Modal>
  );
};
