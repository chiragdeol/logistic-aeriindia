import asyncio
from pymongo import MongoClient

def main():
    client = MongoClient("mongodb://localhost:27017")
    db = client["aeri_logistics"]
    settings = db["settings"].find_one({"_key": "global"})
    print("DB SETTINGS:")
    if settings:
        for k, v in sorted(settings.items()):
            print(f"  {k}: {v}")
    else:
        print("  No settings doc found in MongoDB.")

if __name__ == "__main__":
    main()
