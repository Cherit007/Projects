#!/usr/bin/env python3
"""Builds the iOS "Capture payment" shortcut and signs it so it can be imported.

    python3 scripts/build-ios-shortcut.py [capture-link]

capture-link defaults to financetracker://capture?text= (an installed build).
For Expo Go pass the link shown in the app under Settings > Payment detection,
e.g. exp://192.168.29.16:8081/--/capture?text=

Writes dist/Capture payment.shortcut. Send it to the iPhone (AirDrop) and tap
Add Shortcut. Message automations still have to be created on the phone.
"""

import os
import plistlib
import subprocess
import sys
import tempfile
import uuid

link = sys.argv[1] if len(sys.argv) > 1 else "financetracker://capture?text="
encode_id = str(uuid.uuid4()).upper()
text_id = str(uuid.uuid4()).upper()
placeholder = "\ufffc"
# Ranges are counted in UTF-16 code units.
position = len(link.encode("utf-16-le")) // 2

shortcut = {
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowClientVersion": "2302.0.4",
    "WFWorkflowIcon": {"WFWorkflowIconStartColor": 4292093695, "WFWorkflowIconGlyphNumber": 59511},
    "WFWorkflowTypes": ["ActionExtension"],
    "WFWorkflowInputContentItemClasses": ["WFStringContentItem"],
    "WFWorkflowHasShortcutInputVariables": True,
    "WFWorkflowNoInputBehavior": {
        "Name": "WFWorkflowNoInputBehaviorAskForInput",
        "Parameters": {"ItemClass": "WFStringContentItem"},
    },
    "WFWorkflowImportQuestions": [],
    "WFWorkflowActions": [
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.urlencode",
            "WFWorkflowActionParameters": {
                "UUID": encode_id,
                "WFEncodeMode": "Encode",
                "WFInput": {
                    "Value": {"Type": "ExtensionInput"},
                    "WFSerializationType": "WFTextTokenAttachment",
                },
            },
        },
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
            "WFWorkflowActionParameters": {
                "UUID": text_id,
                "WFTextActionText": {
                    "Value": {
                        "string": link + placeholder,
                        "attachmentsByRange": {
                            "{%d, 1}" % position: {
                                "Type": "ActionOutput",
                                "OutputUUID": encode_id,
                                "OutputName": "URL Encoded Text",
                            }
                        },
                    },
                    "WFSerializationType": "WFTextTokenString",
                },
            },
        },
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.openurl",
            "WFWorkflowActionParameters": {
                "WFInput": {
                    "Value": {"Type": "ActionOutput", "OutputUUID": text_id, "OutputName": "Text"},
                    "WFSerializationType": "WFTextTokenAttachment",
                },
            },
        },
    ],
}

out_dir = os.path.join(os.path.dirname(__file__), "..", "dist")
os.makedirs(out_dir, exist_ok=True)
output = os.path.abspath(os.path.join(out_dir, "Capture payment.shortcut"))

with tempfile.NamedTemporaryFile(suffix=".shortcut", delete=False) as unsigned:
    plistlib.dump(shortcut, unsigned, fmt=plistlib.FMT_BINARY)

try:
    # "anyone" needs the Mac signed into iCloud; "people-who-know-me" does not.
    for mode in ("anyone", "people-who-know-me"):
        result = subprocess.run(
            ["shortcuts", "sign", "--mode", mode, "--input", unsigned.name, "--output", output],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            print(f"Signed for: {mode}")
            break
        print(f"Signing for {mode} failed: {result.stderr.strip()}")
    else:
        sys.exit(1)
finally:
    os.unlink(unsigned.name)

print(f"Created {output}\nLink: {link}")
