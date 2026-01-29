import React from "react";
import EmailsHeader from "../Middle/EmailsHeader";
import EmailList from "../Middle/EmailList";
import type { OverviewLike } from "../../types/legacy";

export type MiddleColumnProps = {
  page: number;
  pageCount: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onCompose: () => void;

  emails: OverviewLike[];
  emptyList: boolean;
  selectedEmailId: string | null;
  onSelectEmail: (email: OverviewLike) => void;

  getEmailId: (email: OverviewLike) => string;
  getColorForEmail: (email: OverviewLike) => string;
};

export default function MiddleColumn(props: MiddleColumnProps) {
  return (
    <>
      <EmailsHeader
        page={props.page}
        pageCount={props.pageCount}
        onPrev={props.onPrevPage}
        onNext={props.onNextPage}
        onCompose={props.onCompose}
      />

      <section className="card list-container">
        <EmailList
          emails={props.emails}
          selectedEmailId={props.selectedEmailId}
          getColorForEmail={props.getColorForEmail}
          getEmailId={props.getEmailId}
          onSelectEmail={props.onSelectEmail}
        />
        <div className={`empty-state ${props.emptyList ? "" : "hidden"}`}>
          No emails match the current filters.
        </div>
      </section>
    </>
  );
}
