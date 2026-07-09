import { COLOR_OPTIONS, ToolbarSettings } from "..";
import { OUTPUT_DETAIL_OPTIONS } from "../../../utils/generate-output";
import { HelpTooltip } from "../../help-tooltip";
import { IconMoon, IconSun } from "../../icons";
import { Switch } from "../../switch";
import { CheckboxField } from "./checkbox-field";
import styles from "./styles.module.scss";

export type SettingsPanelProps = {
  settings: ToolbarSettings;
  onSettingsChange: (patch: Partial<ToolbarSettings>) => void;

  isDarkMode: boolean;
  onToggleTheme: () => void;

  isDevMode: boolean;

  /** Whether the panel is mounted (controls enter/exit class) */
  isVisible: boolean;

  /** Position override: show panel above toolbar when toolbar is near bottom */
  toolbarNearBottom: boolean;

  settingsPage: "main" | "automations";
  onSettingsPageChange: (page: "main" | "automations") => void;

  onHideToolbar: () => void;
};

export function SettingsPanel({
  settings,
  onSettingsChange,
  isDarkMode,
  onToggleTheme,
  isDevMode,
  isVisible,
  toolbarNearBottom,
  onHideToolbar,
}: SettingsPanelProps) {
  return (
    <div
      className={`${styles.settingsPanel} ${isVisible ? styles.enter : styles.exit}`}
      style={
        toolbarNearBottom
          ? { bottom: "auto", top: "calc(100% + 0.5rem)" }
          : undefined
      }
      data-agentation-settings-panel
    >
      <div className={styles.settingsPanelContainer}>
        <div className={styles.settingsPage}>
          <div className={styles.settingsHeader}>
            <div className={styles.settingsBrand}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>DialKit Annotate</span>
            </div>
            <p className={styles.settingsVersion}>local</p>
            <button
              className={styles.themeToggle}
              onClick={onToggleTheme}
              title={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              <span className={styles.themeIconWrapper}>
                <span
                  key={isDarkMode ? "sun" : "moon"}
                  className={styles.themeIcon}
                >
                  {isDarkMode ? <IconSun size={20} /> : <IconMoon size={20} />}
                </span>
              </span>
            </button>
          </div>

          <div className={styles.divider}></div>

          <div className={styles.settingsSection}>
            <div className={styles.settingsRow}>
              <div className={styles.settingsLabel}>
                Output Detail
                <HelpTooltip content="Controls how much detail is included in the copied output" />
              </div>
              <button
                className={styles.cycleButton}
                onClick={() => {
                  const currentIndex = OUTPUT_DETAIL_OPTIONS.findIndex(
                    (opt) => opt.value === settings.outputDetail,
                  );
                  const nextIndex =
                    (currentIndex + 1) % OUTPUT_DETAIL_OPTIONS.length;
                  onSettingsChange({
                    outputDetail: OUTPUT_DETAIL_OPTIONS[nextIndex].value,
                  });
                }}
              >
                <span
                  key={settings.outputDetail}
                  className={styles.cycleButtonText}
                >
                  {
                    OUTPUT_DETAIL_OPTIONS.find(
                      (opt) => opt.value === settings.outputDetail,
                    )?.label
                  }
                </span>
                <span className={styles.cycleDots}>
                  {OUTPUT_DETAIL_OPTIONS.map((option) => (
                    <span
                      key={option.value}
                      className={`${styles.cycleDot} ${settings.outputDetail === option.value ? styles.active : ""}`}
                    />
                  ))}
                </span>
              </button>
            </div>

            <div
              className={`${styles.settingsRow} ${styles.settingsRowMarginTop} ${!isDevMode ? styles.settingsRowDisabled : ""}`}
            >
              <div className={styles.settingsLabel}>
                React Components
                <HelpTooltip
                  content={
                    !isDevMode
                      ? "Disabled — production builds minify component names, making detection unreliable. Use in development mode."
                      : "Include React component names in annotations"
                  }
                />
              </div>
              <Switch
                checked={isDevMode && settings.reactEnabled}
                onChange={(e) =>
                  onSettingsChange({ reactEnabled: e.target.checked })
                }
                disabled={!isDevMode}
              />
            </div>

            <div
              className={`${styles.settingsRow} ${styles.settingsRowMarginTop}`}
            >
              <div className={styles.settingsLabel}>
                Hide Until Restart
                <HelpTooltip content="Hides the toolbar until you open a new tab" />
              </div>
              <Switch
                checked={false}
                onChange={(e) => {
                  if (e.target.checked) onHideToolbar();
                }}
              />
            </div>
          </div>

          <div className={styles.divider}></div>

          <div className={styles.settingsSection}>
            <div
              className={`${styles.settingsLabel} ${styles.settingsLabelMarker}`}
            >
              Marker Color
            </div>
            <div className={styles.colorOptions}>
              {COLOR_OPTIONS.map((color) => (
                <button
                  className={`${styles.colorOption} ${settings.annotationColorId === color.id ? styles.selected : ""}`}
                  style={
                    {
                      "--swatch": color.srgb,
                      "--swatch-p3": color.p3,
                    } as React.CSSProperties
                  }
                  onClick={() =>
                    onSettingsChange({ annotationColorId: color.id })
                  }
                  title={color.label}
                  type="button"
                  key={color.id}
                ></button>
              ))}
            </div>
          </div>

          <div className={styles.divider}></div>

          <div className={styles.settingsSection}>
            <CheckboxField
              className="checkbox-field"
              label="Clear on copy/send"
              checked={settings.autoClearAfterCopy}
              onChange={(e) =>
                onSettingsChange({ autoClearAfterCopy: e.target.checked })
              }
              tooltip="Automatically clear annotations after copying"
            />
            <CheckboxField
              className={styles.checkboxField}
              label="Block page interactions"
              checked={settings.blockInteractions}
              onChange={(e) =>
                onSettingsChange({ blockInteractions: e.target.checked })
              }
            />
          </div>

          <div className={styles.divider} />

          <p className={styles.automationDescription} style={{ padding: "0 0 8px" }}>
            Annotations stay in this browser via localStorage and sync into DialKit&apos;s local
            agent notes. No hosted storage or telemetry.
          </p>
        </div>
      </div>
    </div>
  );
}
