"use client";

import { useEffect } from "react";
import { SCM } from "./lib/supabaseClient";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "./store/store";
import { userAction } from "./store/slice";

const AutoLogin = () => {
    const dispatch = useDispatch<AppDispatch>()
    useEffect(() => {
        const checkSession = async () => {
            const { data, error } = await SCM.get().session();

            if (!data || !data.session || error) return;

            const { data: dbdata, error: err } = await SCM.get().userById(data.session.user.id);
            
            if (err || !dbdata) return;

            dispatch(
                userAction.setInfo({
                    username: dbdata.nickname,
                    role: dbdata.role ?? "guest",
                    uuid: dbdata.id,
                })
            );
        }
        try{
            checkSession();
        }catch{
            
        }
    })

    return null;
}

export default AutoLogin;