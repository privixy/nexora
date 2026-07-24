import { useTranslation } from "react-i18next";
import { SettingSection } from "./SettingControls";
interface SshTabProps {
  renderConnectionsManager?: () => React.ReactNode;
}

export function SshTab({ renderConnectionsManager }: SshTabProps) {
  const { t } = useTranslation();

  return (
    <div>
      <SettingSection
        title={t("sshConnections.title")}
        description={t("sshConnections.manageDesc")}
      >
        {renderConnectionsManager?.()}
      </SettingSection>
    </div>
  );
}
