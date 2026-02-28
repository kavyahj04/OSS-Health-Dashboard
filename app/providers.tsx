//this tells next js to run this component in browser
"use client"

import { SessionProvider } from "next-auth/react"
import React from "react"

export default function Providers({children} : {children: React.ReactNode}) {
    return(
        <SessionProvider>
            {children}
        </SessionProvider>
    )
}