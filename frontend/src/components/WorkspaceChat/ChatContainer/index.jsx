import { useState, useEffect } from "react";
import ChatHistory from "./ChatHistory";
import PromptInput from "./PromptInput";
import Workspace from "@/models/workspace";
import handleChat, { ABORT_STREAM_EVENT } from "@/utils/chat";
import { isMobile } from "react-device-detect";
import { SidebarMobileHeader } from "../../Sidebar";
import { useParams } from "react-router-dom";
import { v4 } from "uuid";

export default function ChatContainer({ workspace, knownHistory = [] }) {
  const { threadSlug = null } = useParams();
  const [message, setMessage] = useState("");
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [chatHistory, setChatHistory] = useState(knownHistory);
  const [socketId, setSocketId] = useState(null);
  const [websocket, setWebsocket] = useState(null);
  const handleMessageChange = (event) => {
    setMessage(event.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!message || message === "") return false;

    const prevChatHistory = [
      ...chatHistory,
      { content: message, role: "user" },
      {
        content: "",
        role: "assistant",
        pending: true,
        userMessage: message,
        animate: true,
      },
    ];

    setChatHistory(prevChatHistory);
    setMessage("");
    setLoadingResponse(true);
  };

  const sendCommand = async (command, submit = false) => {
    if (!command || command === "") return false;
    if (!submit) {
      setMessage(command);
      return;
    }

    const prevChatHistory = [
      ...chatHistory,
      { content: command, role: "user" },
      {
        content: "",
        role: "assistant",
        pending: true,
        userMessage: command,
        animate: true,
      },
    ];

    setChatHistory(prevChatHistory);
    setMessage("");
    setLoadingResponse(true);
  };

  useEffect(() => {
    async function fetchReply() {
      const promptMessage =
        chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
      const remHistory = chatHistory.length > 0 ? chatHistory.slice(0, -1) : [];
      var _chatHistory = [...remHistory];

      // Override hook for new messages to now go to agents until the connection closes
      if (!!websocket) {
        if (!promptMessage || !promptMessage?.userMessage) return false;
        websocket.send(
          JSON.stringify({
            type: "FEEDBACK",
            feedback: promptMessage?.userMessage,
          })
        );
        return;
      }

      if (!promptMessage || !promptMessage?.userMessage) return false;
      if (!!threadSlug) {
        await Workspace.threads.streamChat(
          { workspaceSlug: workspace.slug, threadSlug },
          promptMessage.userMessage,
          (chatResult) =>
            handleChat(
              chatResult,
              setLoadingResponse,
              setChatHistory,
              remHistory,
              _chatHistory,
              setSocketId
            )
        );
      } else {
        await Workspace.streamChat(
          workspace,
          promptMessage.userMessage,
          (chatResult) =>
            handleChat(
              chatResult,
              setLoadingResponse,
              setChatHistory,
              remHistory,
              _chatHistory,
              setSocketId
            )
        );
      }
      return;
    }
    loadingResponse === true && fetchReply();
  }, [loadingResponse, chatHistory, workspace]);

  useEffect(() => {
    function handleWSS() {
      if (!socketId || !!websocket) return;
      const socket = new WebSocket(
        `ws://localhost:3001/api/agent-invocation/${socketId}`
      );

      window.addEventListener(ABORT_STREAM_EVENT, () => {
        websocket.close();
      });

      function handleWSSResponse(event) {
        const data = JSON.parse(event.data);
        if (!data.hasOwnProperty("type")) {
          setChatHistory((prev) => {
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
                chatId: 123,
              },
            ];
          });
          return;
        } else {
          if (!data.content) return;
          setChatHistory((prev) => {
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
                chatId: 123,
              },
            ];
          });
        }
      }

      socket.addEventListener("message", (event) => {
        setLoadingResponse(true);
        try {
          handleWSSResponse(event);
        } catch (e) {
          console.error("Failed to parse data");
          socket.close();
        }
        setLoadingResponse(false);
      });

      socket.addEventListener("close", (_event) => {
        setChatHistory((prev) => [
          ...prev.filter((msg) => !!msg.content),
          {
            uuid: v4(),
            type: "statusResponse",
            content: "Agent session complete.",
            role: "assistant",
            sources: [],
            closed: true,
            error: null,
            animate: false,
            pending: false,
            chatId: 123,
          },
        ]);
        setLoadingResponse(false);
        setWebsocket(null);
        setSocketId(null);
      });
      setWebsocket(socket);
    }
    handleWSS();
  }, [socketId]);

  return (
    <div
      style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
      className="transition-all duration-500 relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-main-gradient w-full h-full overflow-y-scroll border-2 border-outline"
    >
      {isMobile && <SidebarMobileHeader />}
      <div className="flex flex-col h-full w-full md:mt-0 mt-[40px]">
        <ChatHistory
          history={chatHistory}
          workspace={workspace}
          sendCommand={sendCommand}
        />
        <PromptInput
          message={message}
          submit={handleSubmit}
          onChange={handleMessageChange}
          inputDisabled={loadingResponse}
          buttonDisabled={loadingResponse}
          sendCommand={sendCommand}
        />
      </div>
    </div>
  );
}
