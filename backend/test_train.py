from ntes import NTESClient

client = NTESClient(timeout=15, retries=3)

train_no = "13028"
date = "09-Sep-2026"

print(f"\nFetching live status for train {train_no}...\n")

try:
    data = client.live_status(train_no, date)

    print("RAW RESPONSE:")
    print(data)

except Exception as e:
    print("\nNTES ERROR:")
    print(type(e).__name__, str(e))