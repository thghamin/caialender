import { describe, expect, it } from "vitest";
import { isBanned, nicknameError, parseRoom, reportMessage, warningMessage } from "@/lib/chat";

describe("소통방 규칙", () => {
  it("닉네임: 2~12자, 한글·영문·숫자·밑줄, 관리자 사칭 금지", () => {
    expect(nicknameError("공부왕")).toBeNull();
    expect(nicknameError("a")).toMatch(/2~12자/);
    expect(nicknameError("열세글자가넘는아주긴닉네임")).toMatch(/2~12자/);
    expect(nicknameError("공부 왕")).toMatch(/한글·영문/);
    // 자음·모음만으로도 된다
    expect(nicknameError("ㅇㅇㅇ")).toBeNull();
    expect(nicknameError("ㅋㅋ")).toBeNull();
    expect(nicknameError("공부ㅋ")).toBeNull();
    expect(nicknameError("ㅏㅑ")).toBeNull();
    expect(nicknameError("ㅇㅇ!")).toMatch(/특수문자/);
    expect(nicknameError("학생회장")).toMatch(/관리자/);
    expect(nicknameError("Admin1")).toMatch(/관리자/);
  });
  it("방은 1~4학년만", () => {
    expect(parseRoom("2")).toBe(2);
    expect(parseRoom("5")).toBeNull();
    expect(parseRoom("x")).toBeNull();
  });
  it("경고 3번이면 이용 제한, 알림 문구에 횟수와 사유", () => {
    expect(isBanned({ warnings: 2 })).toBe(false);
    expect(isBanned({ warnings: 3 })).toBe(true);
    expect(warningMessage(1, "도배")).toMatchObject({ title: "⚠️ 소통방 경고 1/3", url: "/chat" });
    expect(warningMessage(1, "도배").body).toContain("사유: 도배");
    expect(warningMessage(3, "욕설").body).toContain("더 이상 이용할 수 없어요");
  });
  it("신고 알림 문구", () => {
    expect(reportMessage(2, "도배")).toEqual({ title: "🚨 소통방 신고가 들어왔어요", body: "2학년 소통방 · 사유: 도배", url: "/chat/reports" });
  });
});
