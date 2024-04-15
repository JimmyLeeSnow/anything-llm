import { v4 } from "uuid";
import { safeJsonParse } from "../request";
import { saveAs } from "file-saver";

const handledEvents = [
  "statusResponse",
  "fileDownload",
  "awaitingFeedback",
  "wssFailure",
  "rechartVisualize",
];

export default function handleSocketResponse(event, setChatHistory) {
  const data = safeJsonParse(event.data, null);
  if (data === null) return;

  // No message type is defined then this is a generic message
  // that we need to print to the user as a system response
  if (!data.hasOwnProperty("type")) {
    return setChatHistory((prev) => {
      return [
        ...prev.filter((msg) => !!msg.content),
        {
          uuid: v4(),
          content: data.content,
          role: "assistant",
          sources: [],
          closed: true,
          error: null,
          animate: false,
          pending: false,
        },
      ];
    });
  }

  if (!handledEvents.includes(data.type) || !data.content) return;

  if (data.type === "fileDownload") {
    saveAs(data.content.b64Content, data.content.filename ?? "unknown.txt");
    return;
  }

  if (data.type === "rechartVisualize") {
    return setChatHistory((prev) => {
      return [
        ...prev.filter((msg) => !!msg.content),
        {
          type: "rechartVisualize",
          uuid: v4(),
          content: data.content,
          role: "assistant",
          sources: [],
          closed: true,
          error: null,
          animate: false,
          pending: false,
        },
      ];
    });
  }

  if (data.type === "wssFailure") {
    return setChatHistory((prev) => {
      return [
        ...prev.filter((msg) => !!msg.content),
        {
          uuid: v4(),
          content: data.content,
          role: "assistant",
          sources: [],
          closed: true,
          error: data.content,
          animate: false,
          pending: false,
        },
      ];
    });
  }

  return setChatHistory((prev) => {
    return [
      ...prev.filter((msg) => !!msg.content),
      {
        uuid: v4(),
        type: data.type,
        content: data.content,
        role: "assistant",
        sources: [],
        closed: true,
        error: null,
        animate: false,
        pending: false,
      },
    ];
  });
}
