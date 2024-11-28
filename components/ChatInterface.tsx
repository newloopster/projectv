'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Video, Mic, MicOff, Send, SkipForward } from 'lucide-react'
import { toast } from "@/components/ui/use-toast"
import { ErrorBoundary } from 'react-error-boundary'

type Message = {
  id: string
  text: string
  sender: 'user' | 'stranger'
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL,
    username: process.env.NEXT_PUBLIC_TURN_SERVER_USERNAME,
    credential: process.env.NEXT_PUBLIC_TURN_SERVER_CREDENTIAL
  }
]

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isMicOn, setIsMicOn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userVideoRef = useRef<HTMLVideoElement>(null)
  const strangerVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  const connectToSignalingServer = useCallback(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'ws://localhost:3001')
    wsRef.current = ws

    ws.onopen = () => {
      console.log('Connected to signaling server')
      findPartner()
    }

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data)
      switch (data.type) {
        case 'partner_found':
          await createPeerConnection()
          if (peerConnectionRef.current!.localDescription) {
            const offer = await peerConnectionRef.current!.createOffer()
            await peerConnectionRef.current!.setLocalDescription(offer)
            ws.send(JSON.stringify({ type: 'offer', offer }))
          }
          break
        case 'offer':
          await createPeerConnection()
          await peerConnectionRef.current!.setRemoteDescription(new RTCSessionDescription(data.offer))
          const answer = await peerConnectionRef.current!.createAnswer()
          await peerConnectionRef.current!.setLocalDescription(answer)
          ws.send(JSON.stringify({ type: 'answer', answer }))
          break
        case 'answer':
          await peerConnectionRef.current!.setRemoteDescription(new RTCSessionDescription(data.answer))
          break
        case 'ice-candidate':
          if (peerConnectionRef.current && data.candidate) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
            } catch (e) {
              console.error('Error adding received ice candidate', e)
            }
          }
          break
        case 'partner_disconnected':
          handleDisconnect()
          break
      }
    }

    ws.onclose = () => {
      console.log('Disconnected from signaling server')
      handleDisconnect()
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      toast({
        title: "Connection Error",
        description: "Failed to connect to the chat server. Please try again later.",
        variant: "destructive",
      })
    }
  }, [])

  useEffect(() => {
    connectToSignalingServer()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [connectToSignalingServer])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const createPeerConnection = async () => {
    try {
      const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      peerConnectionRef.current = peerConnection

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          wsRef.current?.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }))
        }
      }

      peerConnection.ontrack = (event) => {
        if (strangerVideoRef.current && event.streams[0]) {
          strangerVideoRef.current.srcObject = event.streams[0]
        }
      }

      peerConnection.ondatachannel = (event) => {
        dataChannelRef.current = event.channel
        setupDataChannel()
      }

      const dataChannel = peerConnection.createDataChannel('chat')
      dataChannelRef.current = dataChannel
      setupDataChannel()

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current!)
        })
      }

      setIsConnected(true)
      setIsLoading(false)
    } catch (error) {
      console.error('Error creating peer connection:', error)
      toast({
        title: "Connection Error",
        description: "Failed to establish a peer connection. Please try again.",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  const setupDataChannel = () => {
    if (!dataChannelRef.current) return

    dataChannelRef.current.onmessage = (event) => {
      const message: Message = {
        id: Date.now().toString(),
        text: event.data,
        sender: 'stranger'
      }
      setMessages(prev => [...prev, message])
    }

    dataChannelRef.current.onopen = () => {
      setIsConnected(true)
      setIsLoading(false)
    }

    dataChannelRef.current.onclose = () => {
      setIsConnected(false)
    }
  }

  const findPartner = () => {
    setIsConnected(false);
    setMessages([]);
    setIsLoading(true);
    wsRef.current?.send(JSON.stringify({ type: 'find_partner' }));
  };

  const handleDisconnect = () => {
    setIsConnected(false)
    setMessages([])
    setIsLoading(false)
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
    }
    if (strangerVideoRef.current) {
      strangerVideoRef.current.srcObject = null
    }
  }

  const handleSendMessage = () => {
    if (inputMessage.trim() !== '' && dataChannelRef.current) {
      const newMessage: Message = {
        id: Date.now().toString(),
        text: inputMessage,
        sender: 'user'
      }
      setMessages(prev => [...prev, newMessage])
      dataChannelRef.current.send(inputMessage)
      setInputMessage('')
    }
  }

  const toggleCamera = async () => {
    try {
      if (!isCameraOn) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream
        }
        localStreamRef.current = stream
        stream.getVideoTracks().forEach(track => {
          peerConnectionRef.current?.addTrack(track, stream)
        })
        setIsCameraOn(true)
      } else {
        const stream = userVideoRef.current?.srcObject as MediaStream
        stream?.getVideoTracks().forEach(track => {
          track.stop()
          peerConnectionRef.current?.getSenders()
            .find(sender => sender.track === track)
            ?.replace(null)
        })
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = null
        }
        setIsCameraOn(false)
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      toast({
        title: "Camera Error",
        description: "Failed to access the camera. Please check your permissions.",
        variant: "destructive",
      })
    }
  }

  const toggleMic = async () => {
    try {
      if (!isMicOn) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        localStreamRef.current = localStreamRef.current 
          ? new MediaStream([...localStreamRef.current.getTracks(), ...stream.getTracks()])
          : stream
        stream.getAudioTracks().forEach(track => {
          peerConnectionRef.current?.addTrack(track, stream)
        })
        setIsMicOn(true)
      } else {
        localStreamRef.current?.getAudioTracks().forEach(track => {
          track.stop()
          peerConnectionRef.current?.getSenders()
            .find(sender => sender.track === track)
            ?.replace(null)
        })
        setIsMicOn(false)
      }
    } catch (error) {
      console.error('Error accessing microphone:', error)
      toast({
        title: "Microphone Error",
        description: "Failed to access the microphone. Please check your permissions.",
        variant: "destructive",
      })
    }
  }

  return (
    <ErrorBoundary fallback={<div>Something went wrong. Please refresh the page.</div>}>
      <Card className="w-full max-w-6xl h-[600px] flex flex-col md:flex-row">
        <div className="w-full md:w-2/3 flex flex-col">
          <CardHeader className="p-4">
            <CardTitle className="text-2xl font-bold">vmigle</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow grid grid-rows-2 gap-4 p-4">
            <div className="bg-gray-200 relative">
              <video ref={strangerVideoRef} className="w-full h-full object-cover" autoPlay playsInline aria-label="Stranger's video" />
              {!isConnected && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white">
                  {isLoading ? 'Connecting...' : 'Waiting for partner...'}
                </div>
              )}
            </div>
            <div className="bg-gray-200 relative">
              <video ref={userVideoRef} className="w-full h-full object-cover" autoPlay playsInline muted aria-label="Your video" />
              {!isCameraOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white">
                  Camera is off
                </div>
              )}
            </div>
          </CardContent>
        </div>
        <div className="w-full md:w-1/3 flex flex-col border-t md:border-l md:border-t-0">
          <CardContent className="flex-grow overflow-y-auto p-4 space-y-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-2 ${
                    message.sender === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </CardContent>
          <CardFooter className="flex flex-col gap-2 p-4 border-t">
            <div className="flex justify-between w-full">
              <Button variant={isCameraOn ? "default" : "outline"} size="icon" onClick={toggleCamera}>
                <Video className="h-4 w-4" />
              </Button>
              <Button variant={isMicOn ? "default" : "outline"} size="icon" onClick={toggleMic}>
                {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon">
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button variant="destructive" size="icon" onClick={findPartner}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex w-full gap-2">
              <Input
                placeholder="Type a message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                aria-label="Type your message"
              />
              <Button onClick={handleSendMessage}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </div>
      </Card>
    </ErrorBoundary>
  )
}

