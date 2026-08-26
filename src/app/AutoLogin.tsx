"use client";

import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { useAuthSession } from "@/src/modules/identity";
import type { AppDispatch } from "./store/store";
import { userAction } from "./store/slice";

const AutoLogin = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { restore } = useAuthSession();
    const restorePromiseRef = useRef<ReturnType<typeof restore> | null>(null);

    useEffect(() => {
        let isActive = true;
        restorePromiseRef.current ??= restore();

        void restorePromiseRef.current.then((result) => {
            if (!isActive || !result.ok || !result.value.profile) return;
            const profile = result.value.profile;
            dispatch(userAction.setInfo({
                username: profile.nickname,
                role: profile.role,
                uuid: profile.id,
            }));
        });

        return () => {
            isActive = false;
        };
    }, [dispatch, restore]);

    return null;
};

export default AutoLogin;
