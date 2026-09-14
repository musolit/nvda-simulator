"use client";

import { useState } from "react";
import TopBar from "../TopBar";
import { PillButton } from "@/components/ui";
import BuyLotForm from "./BuyLotForm";
import BuyLotList from "./BuyLotList";
import SellTxForm from "./SellTxForm";
import SellTxList from "./SellTxList";
import KakaoImport from "./KakaoImport";

type Tab = "buy" | "sell" | "import";

export default function TransactionsPage() {
  const [tab, setTab] = useState<Tab>("buy");

  return (
    <>
      <TopBar title="거래내역" />
      <div className="space-y-4 p-4">
        <div className="flex gap-2">
          <PillButton active={tab === "buy"} onClick={() => setTab("buy")}>
            매수
          </PillButton>
          <PillButton active={tab === "sell"} onClick={() => setTab("sell")}>
            매도
          </PillButton>
          <PillButton active={tab === "import"} onClick={() => setTab("import")}>
            카톡 가져오기
          </PillButton>
        </div>
        {tab === "buy" && (
          <>
            <BuyLotForm />
            <BuyLotList />
          </>
        )}
        {tab === "sell" && (
          <>
            <SellTxForm />
            <SellTxList />
          </>
        )}
        {tab === "import" && <KakaoImport />}
      </div>
    </>
  );
}
