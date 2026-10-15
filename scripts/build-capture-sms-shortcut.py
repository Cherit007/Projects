#!/usr/bin/env python3
"""Builds a signed "Capture bank SMS" shortcut for installed iOS builds.

    python3 scripts/build-capture-sms-shortcut.py [team-id]

The shortcut contains the app's Capture bank SMS action with Message set to
Shortcut Input. After importing it on the iPhone, add a Message trigger in the
shortcut (Edit > Automation > Message). team-id defaults to APPLE_TEAM_ID.
Writes dist/Capture bank SMS.shortcut.
"""

import os
import plistlib
import subprocess
import sys
import tempfile

BUNDLE_ID = "com.cherit.financetracker"
APP_NAME = "FinanceTracker"
INTENT = "CaptureBankSmsIntent"

team_id = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("APPLE_TEAM_ID")
if not team_id:
    sys.exit("Pass the Apple team ID or set APPLE_TEAM_ID")

shortcut = {
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowClientVersion": "2302.0.4",
    "WFWorkflowIcon": {"WFWorkflowIconStartColor": 4292093695, "WFWorkflowIconGlyphNumber": 59511},
    "WFWorkflowTypes": [],
    "WFWorkflowInputContentItemClasses": ["WFStringContentItem"],
    "WFWorkflowHasShortcutInputVariables": True,
    "WFWorkflowImportQuestions": [],
    "WFWorkflowActions": [
        {
            "WFWorkflowActionIdentifier": f"{BUNDLE_ID}.{INTENT}",
            "WFWorkflowActionParameters": {
                "AppIntentDescriptor": {
                    "AppIntentIdentifier": INTENT,
                    "BundleIdentifier": BUNDLE_ID,
                    "Name": APP_NAME,
                    "TeamIdentifier": team_id,
                },
                "message": {
                    "Value": {"Type": "ExtensionInput"},
                    "WFSerializationType": "WFTextTokenAttachment",
                },
            },
        },
    ],
}

out_dir = os.path.join(os.path.dirname(__file__), "..", "dist")
os.makedirs(out_dir, exist_ok=True)
output = os.path.abspath(os.path.join(out_dir, "Capture bank SMS.shortcut"))

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

print(f"Created {output}")
