import { connectToDebugWS } from "@lib/debug";
import { React, ReactNative as RN } from "@metro/common";
import { Forms } from "@ui/components";
import Version from "./Version";

const { FormRow, FormSection, FormInput } = Forms;
const hermesProps = window.HermesInternal.getRuntimeProperties();
const rnVer = RN.Platform.constants.reactNativeVersion;

export default function Settings() {
    const [debuggerUrl, setDebuggerUrl] = React.useState("");

    const versions = [
        {
            label: "Discord",
            version: RN.NativeModules.InfoDictionaryManager.Version,
        },
        {
            label: "React",
            version: React.version,
        },
        {
            label: "React Native",
            version: `${rnVer.major || 0}.${rnVer.minor || 0}.${rnVer.patch || 0}`,
        },
        {
            label: "Hermes",
            version: `${hermesProps["OSS Release Version"]} ${hermesProps["Build"]}`,
        },
        {
            label: "Bytecode",
            version: hermesProps["Bytecode Version"],
        },
    ];

    return ( 
        <>
            {/* Why is there still a divider? */}
            <FormSection title="Debug" android_noDivider>
                <FormInput 
                    value={debuggerUrl}
                    onChange={(v: string) => setDebuggerUrl(v)}
                    title="DEBUGGER URL"
                />
            </FormSection>
            <FormSection title="Actions">
                <FormRow
                    label="Reload Discord"
                    trailing={FormRow.Arrow}
                    onPress={() => RN.NativeModules.BundleUpdaterManager.reload()}
                />
                <FormRow
                    label="Connect to debug websocket"
                    trailing={FormRow.Arrow}
                    onPress={() => connectToDebugWS(debuggerUrl)}
                />
            </FormSection>
            <FormSection title="Versions">
                {versions.map((v) => <Version label={v.label} version={v.version} /> )}
            </FormSection>
        </>
    )
}